import { Agent, getAgentByName, routeAgentRequest } from "agents";

import { decryptJson, encryptJson, signJson, stableHash, verifySignedJson, type EncryptedJson } from "./crypto";
import {
  AGENT_GOOGLE_HEALTH_SCOPES,
  assertDataPointMatchesDataType,
  batchDeleteDataPoints,
  buildExerciseDataPoint,
  buildSleepDataPoint,
  buildStepsDataPoint,
  buildWeightDataPoint,
  createDataPoint,
  dataPointName,
  exchangeGoogleCode,
  fetchHealthContext,
  getOperation,
  listDataPoints,
  patchDataPoint,
  refreshGoogleAccessToken,
  rollUpDataPoints
} from "./google-health";
import { GoogleHealthApiError } from "./google-health";
import type { GoogleTokenResponse, Operation } from "./google-health";
import {
  emptyResponse,
  errorResponse,
  handleOptions,
  HttpError,
  isAllowedReturnTo,
  jsonResponse,
  readJson,
  requireBearerAuth,
  requireInternalAuth,
  withCors
} from "./http";
import {
  parseAskInput,
  parseConnectInput,
  parseCreateOwnedInput,
  parseDeleteOwnedInput,
  parseExerciseInput,
  parseGoogleTokenResponse,
  parseListDataPointsInput,
  parsePatchOwnedInput,
  parseRollupInput,
  parseSleepInput,
  parseSnapshotInput,
  parseStepsInput,
  parseWeightInput
} from "./validation";
import type {
  AskInput,
  CreateOwnedInput,
  DeleteOwnedInput,
  ListDataPointsInput,
  PatchOwnedInput,
  RollupInput,
  SnapshotInput
} from "./validation";

type StoredRefreshToken = {
  refreshToken: string;
  scope?: string;
  tokenType?: string;
};

type AppEnv = Env & {
  GOOGLE_CLIENT_SECRET: string;
  HEALTH_AGENT_API_TOKEN: string;
  OAUTH_STATE_SECRET?: string;
  TOKEN_ENCRYPTION_KEY: string;
};

type HealthAgentState = {
  google?: {
    connectedAt: string;
    refreshToken: EncryptedJson;
    scope?: string;
  };
};

type LedgerRow = {
  client_record_id: string;
  created_at: string;
  data_type: string;
  google_name: string;
  id: string;
  operation_json: string | null;
  payload_json: string | null;
  status: LedgerStatus;
  updated_at: string;
};

type CoachMessageRow = {
  content: string;
  created_at: string;
  id: string;
  role: "assistant" | "user";
};

type LedgerStatus =
  | "active"
  | "deleted"
  | "failed_create"
  | "pending_create"
  | "pending_delete"
  | "pending_patch"
  | "unknown_create"
  | "unknown_delete"
  | "unknown_patch";

type MutationResult = Record<string, unknown> & { pending: boolean };

type OAuthState = {
  createdAt: number;
  nonce: string;
  returnTo?: string;
  userId: string;
};

const DEFAULT_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_OAUTH_STATE_AGE_MS = 10 * 60 * 1000;
const UNTRACKABLE_OPERATION_TIMEOUT_MS = 15 * 60 * 1000;
const COACH_MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class FittyHealthAgent extends Agent<AppEnv, HealthAgentState> {
  initialState: HealthAgentState = {};

  async onStart(): Promise<void> {
    this.sql`
      CREATE TABLE IF NOT EXISTS owned_google_records (
        id TEXT PRIMARY KEY,
        data_type TEXT NOT NULL,
        google_name TEXT NOT NULL UNIQUE,
        client_record_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        payload_json TEXT,
        operation_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    this.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_owned_google_records_client
      ON owned_google_records (data_type, client_record_id)
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_owned_google_records_status
      ON owned_google_records (status)
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS coach_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_coach_messages_created_at
      ON coach_messages (created_at)
    `;
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, this.env);
    }

    try {
      const path = agentSubpath(new URL(request.url).pathname);

      if (request.method === "POST" && path === "/internal/connect-google") {
        await requireInternalAuth(request, this.env);
        const body = parseGoogleTokenResponse(await readJson(request));
        return jsonResponse(await this.storeGoogleToken(body), request, this.env);
      }

      await requireBearerAuth(request, this.env);

      if (request.method === "GET" && path === "/status") {
        return jsonResponse(await this.status(), request, this.env);
      }

      if (request.method === "POST" && path === "/connect") {
        const body = parseConnectInput(await readJson(request));
        return jsonResponse(
          await this.storeGoogleToken({
            access_token: "",
            refresh_token: body.refreshToken,
            scope: body.scope,
            token_type: body.tokenType
          }),
          request,
          this.env
        );
      }

      if (request.method === "POST" && path === "/ask") {
        return jsonResponse(await this.answerQuestion(parseAskInput(await readJson(request))), request, this.env);
      }

      if (request.method === "GET" && path === "/messages") {
        return jsonResponse({ messages: await this.listMessages() }, request, this.env);
      }

      if (request.method === "DELETE" && path === "/messages") {
        this.sql`DELETE FROM coach_messages`;
        return emptyResponse(request, this.env);
      }

      if (request.method === "POST" && path === "/snapshot") {
        return jsonResponse(await this.snapshot(parseSnapshotInput(await readJson(request))), request, this.env);
      }

      if (request.method === "POST" && path === "/data-points/list") {
        return jsonResponse(
          await this.listDataPoints(parseListDataPointsInput(await readJson(request))),
          request,
          this.env
        );
      }

      if (request.method === "POST" && path === "/data-points/rollup") {
        return jsonResponse(await this.rollup(parseRollupInput(await readJson(request))), request, this.env);
      }

      if (request.method === "POST" && path === "/data-points/create") {
        const result = await this.createOwnedDataPoint(parseCreateOwnedInput(await readJson(request)));
        return jsonResponse(result, request, this.env, { status: result.pending ? 202 : 201 });
      }

      if (request.method === "PATCH" && path === "/data-points") {
        const result = await this.patchOwnedDataPoint(parsePatchOwnedInput(await readJson(request)));
        return jsonResponse(result, request, this.env, { status: result.pending ? 202 : 200 });
      }

      if (request.method === "DELETE" && path === "/data-points") {
        const result = await this.deleteOwnedDataPoints(parseDeleteOwnedInput(await readJson(request)));
        return jsonResponse(result, request, this.env, { status: result.pending ? 202 : 200 });
      }

      if (request.method === "POST" && path === "/weight") {
        const body = parseWeightInput(await readJson(request));
        const result = await this.createOwnedDataPoint({
          clientRecordId: body.clientRecordId,
          dataPoint: buildWeightDataPoint(body),
          dataType: "weight"
        });
        return jsonResponse(
          result,
          request,
          this.env,
          { status: result.pending ? 202 : 201 }
        );
      }

      if (request.method === "POST" && path === "/steps") {
        const body = parseStepsInput(await readJson(request));
        const result = await this.createOwnedDataPoint({
          clientRecordId: body.clientRecordId,
          dataPoint: buildStepsDataPoint(body),
          dataType: "steps"
        });
        return jsonResponse(
          result,
          request,
          this.env,
          { status: result.pending ? 202 : 201 }
        );
      }

      if (request.method === "POST" && path === "/sleep") {
        const body = parseSleepInput(await readJson(request));
        const result = await this.createOwnedDataPoint({
          clientRecordId: body.clientRecordId,
          dataPoint: buildSleepDataPoint(body),
          dataType: "sleep"
        });
        return jsonResponse(
          result,
          request,
          this.env,
          { status: result.pending ? 202 : 201 }
        );
      }

      if (request.method === "POST" && path === "/exercise") {
        const body = parseExerciseInput(await readJson(request));
        const result = await this.createOwnedDataPoint({
          clientRecordId: body.clientRecordId,
          dataPoint: buildExerciseDataPoint(body),
          dataType: "exercise"
        });
        return jsonResponse(
          result,
          request,
          this.env,
          { status: result.pending ? 202 : 201 }
        );
      }

      throw new HttpError(404, "Not found");
    } catch (error) {
      return errorResponse(error, request, this.env);
    }
  }

  private async status(): Promise<Record<string, unknown>> {
    const reconciliation = await this.reconcilePendingOperations();
    const counts = Object.fromEntries(
      this.sql<{ count: number; status: LedgerStatus }>`
        SELECT status, COUNT(*) AS count
        FROM owned_google_records
        GROUP BY status
      `.map((row) => [row.status, row.count])
    );

    return {
      connected: Boolean(this.state.google),
      googleScope: this.state.google?.scope,
      lastConnectedAt: this.state.google?.connectedAt,
      ownedRecords: {
        active: counts.active ?? 0,
        deleted: counts.deleted ?? 0,
        failedCreate: counts.failed_create ?? 0,
        pendingCreate: counts.pending_create ?? 0,
        pendingDelete: counts.pending_delete ?? 0,
        pendingPatch: counts.pending_patch ?? 0,
        unknownCreate: counts.unknown_create ?? 0,
        unknownDelete: counts.unknown_delete ?? 0,
        unknownPatch: counts.unknown_patch ?? 0
      },
      reconciliation
    };
  }

  private async storeGoogleToken(token: GoogleTokenResponse): Promise<Record<string, unknown>> {
    const refreshToken = token.refresh_token;
    if (!refreshToken) {
      throw new HttpError(400, "Google OAuth did not return a refresh token. Re-run consent with prompt=consent.");
    }
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
    }

    const stored: StoredRefreshToken = {
      refreshToken,
      scope: token.scope,
      tokenType: token.token_type
    };

    this.setState({
      ...this.state,
      google: {
        connectedAt: new Date().toISOString(),
        refreshToken: await encryptJson(stored, this.env.TOKEN_ENCRYPTION_KEY),
        scope: token.scope
      }
    });

    return {
      connected: true,
      scope: token.scope
    };
  }

  private async getAccessToken(): Promise<string> {
    if (!this.state.google) {
      throw new HttpError(409, "Google Health is not connected for this agent instance");
    }
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
    }

    const stored = parseStoredRefreshToken(
      await decryptJson(this.state.google.refreshToken, this.env.TOKEN_ENCRYPTION_KEY)
    );
    const refreshed = await refreshGoogleAccessToken(this.env, stored.refreshToken);

    if (refreshed.refresh_token && refreshed.refresh_token !== stored.refreshToken) {
      await this.storeGoogleToken(refreshed);
    }

    return refreshed.access_token;
  }

  private async answerQuestion(input: AskInput): Promise<Record<string, unknown>> {
    const question = input.question.trim();
    if (question.length > 4000) {
      throw new HttpError(400, "question is too long");
    }

    const days = clampDays(input.days, 30);
    const context = await fetchHealthContext(await this.getAccessToken(), { days });
    const history = await this.listMessages(20);
    const userMessage = await this.saveMessage("user", question);
    const model = this.env.AI_MODEL || DEFAULT_AI_MODEL;
    const result = await this.env.AI.run(model, {
      messages: [
        {
          content:
            "You are OpenFit's Personal Health-Data Coach. Help the user understand patterns in their own Google Health data and choose small, low-risk everyday actions. Use only the provided health data for health claims, be concise and quantitative, and make uncertainty explicit. Never diagnose, prescribe, change medication, recommend supplement doses, encourage aggressive calorie restriction, or claim medical certainty. If symptoms may be urgent, tell the user to seek qualified care. You may help clarify a nutrition description, but never claim that food was saved unless a verified app event says so. If data is missing or an API call failed, say so clearly.",
          role: "system"
        },
        ...history.map((message) => ({ content: message.content, role: message.role })),
        {
          content: `Question: ${question}\n\nGoogle Health data JSON:\n${JSON.stringify(context).slice(0, 24000)}`,
          role: "user"
        }
      ]
    });

    const answer = extractAiText(result);
    const assistantMessage = await this.saveMessage("assistant", answer);

    return {
      answer,
      dataWindow: context.range,
      messages: [userMessage, assistantMessage],
      model
    };
  }

  private async listMessages(limit = 100): Promise<CoachMessageRow[]> {
    this.purgeExpiredMessages();
    const safeLimit = Math.max(1, Math.min(Math.round(limit), 200));
    const messages = this.sql<CoachMessageRow>`
      SELECT id, role, content, created_at
      FROM (
        SELECT id, role, content, created_at
        FROM coach_messages
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      )
      ORDER BY created_at ASC
    `;
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        content: await this.decryptMessageContent(message.content)
      }))
    );
  }

  private async saveMessage(role: CoachMessageRow["role"], content: string): Promise<CoachMessageRow> {
    this.purgeExpiredMessages();
    const message = {
      content,
      created_at: new Date().toISOString(),
      id: crypto.randomUUID(),
      role
    };
    const encryptedContent = JSON.stringify(await encryptJson({ content }, this.messageEncryptionKey()));
    this.sql`
      INSERT INTO coach_messages (id, role, content, created_at)
      VALUES (${message.id}, ${message.role}, ${encryptedContent}, ${message.created_at})
    `;
    return message;
  }

  private purgeExpiredMessages(): void {
    const cutoff = new Date(Date.now() - COACH_MESSAGE_RETENTION_MS).toISOString();
    this.sql`DELETE FROM coach_messages WHERE created_at < ${cutoff}`;
  }

  private messageEncryptionKey(): string {
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
    }
    return this.env.TOKEN_ENCRYPTION_KEY;
  }

  private async decryptMessageContent(stored: string): Promise<string> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return stored;
    }

    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      typeof parsed.ciphertext !== "string" ||
      typeof parsed.iv !== "string"
    ) {
      return stored;
    }

    const decrypted = await decryptJson(parsed as EncryptedJson, this.messageEncryptionKey());
    if (!isRecord(decrypted) || typeof decrypted.content !== "string") {
      throw new HttpError(500, "Stored coach message is invalid");
    }
    return decrypted.content;
  }

  private async snapshot(input: SnapshotInput): Promise<Record<string, unknown>> {
    return fetchHealthContext(await this.getAccessToken(), { days: clampDays(input.days, 30) });
  }

  private async listDataPoints(input: ListDataPointsInput): Promise<Record<string, unknown>> {
    const dataType = requireDataType(input.dataType);
    return listDataPoints(await this.getAccessToken(), dataType, {
      filter: input.filter,
      pageSize: input.pageSize,
      pageToken: input.pageToken
    });
  }

  private async rollup(input: RollupInput): Promise<Record<string, unknown>> {
    const dataType = requireDataType(input.dataType);

    return rollUpDataPoints(await this.getAccessToken(), dataType, {
      endTime: input.endTime,
      pageSize: input.pageSize,
      startTime: input.startTime,
      windowSize: input.windowSize
    });
  }

  private async createOwnedDataPoint(input: CreateOwnedInput): Promise<MutationResult> {
    const dataType = requireDataType(input.dataType);
    const dataPoint = input.dataPoint;
    const clientRecordId = await normalizeClientRecordId(input.clientRecordId);
    const accessToken = await this.getAccessToken();
    const existing = this.findRecordByClientRecordId(dataType, clientRecordId);

    if (existing && existing.status !== "failed_create") {
      if (existing.status === "unknown_create") {
        throw new HttpError(409, "The previous create outcome is unknown; use a new clientRecordId");
      }
      if (existing.status === "deleted" || existing.status === "pending_delete") {
        throw new HttpError(409, "clientRecordId belongs to a deleted or deleting record; use a new id");
      }
      return {
        idempotent: true,
        pending: existing.status !== "active",
        record: publicLedgerRecord(existing)
      };
    }

    const googleName = dataPointName(dataType, clientRecordId);
    const payload = { ...dataPoint, name: googleName };
    const now = new Date().toISOString();
    const id = existing?.id ?? crypto.randomUUID();

    if (existing) {
      this.sql`
        UPDATE owned_google_records
        SET status = 'pending_create', payload_json = ${JSON.stringify(payload)}, operation_json = NULL, updated_at = ${now}
        WHERE id = ${id} AND status = 'failed_create'
      `;
    } else {
      this.sql`
        INSERT INTO owned_google_records
          (id, data_type, google_name, client_record_id, status, payload_json, operation_json, created_at, updated_at)
        VALUES
          (${id}, ${dataType}, ${googleName}, ${clientRecordId}, 'pending_create', ${JSON.stringify(payload)}, NULL, ${now}, ${now})
      `;
    }

    let operation: Operation;
    try {
      operation = await createDataPoint(accessToken, dataType, payload);
    } catch (error) {
      this.setDefinitiveRequestFailure(id, "pending_create", "failed_create", error);
      throw error;
    }
    const status = operationRecordStatus(operation, "pending_create");
    const completedAt = new Date().toISOString();
    this.sql`
      UPDATE owned_google_records
      SET status = ${status}, operation_json = ${JSON.stringify(operation)}, updated_at = ${completedAt}
      WHERE id = ${id} AND status = 'pending_create'
    `;
    throwIfOperationFailed(operation);

    return {
      operation,
      pending: status === "pending_create",
      record: {
        clientRecordId,
        dataType,
        googleName,
        id,
        status,
        updatedAt: completedAt
      }
    };
  }

  private async patchOwnedDataPoint(input: PatchOwnedInput): Promise<MutationResult> {
    const dataType = requireDataType(input.dataType);
    const dataPoint = input.dataPoint;
    assertDataPointMatchesDataType(dataType, dataPoint);
    const accessToken = await this.getAccessToken();
    const record = this.findOwnedRecord(dataType, input);
    const payload = { ...dataPoint, name: record.google_name };
    const now = new Date().toISOString();

    this.sql`
      UPDATE owned_google_records
      SET status = 'pending_patch', payload_json = ${JSON.stringify(payload)}, operation_json = NULL, updated_at = ${now}
      WHERE id = ${record.id} AND status = 'active'
    `;

    let operation: Operation;
    try {
      operation = await patchDataPoint(accessToken, record.google_name, payload);
    } catch (error) {
      this.setDefinitiveRequestFailure(record.id, "pending_patch", "active", error);
      throw error;
    }
    const status = operationRecordStatus(operation, "pending_patch");
    const completedAt = new Date().toISOString();
    this.sql`
      UPDATE owned_google_records
      SET status = ${status}, operation_json = ${JSON.stringify(operation)}, updated_at = ${completedAt}
      WHERE id = ${record.id} AND status = 'pending_patch'
    `;
    throwIfOperationFailed(operation);

    return {
      operation,
      pending: status === "pending_patch",
      record: publicLedgerRecord({ ...record, payload_json: JSON.stringify(payload), status, updated_at: completedAt })
    };
  }

  private async deleteOwnedDataPoints(input: DeleteOwnedInput): Promise<MutationResult> {
    const accessToken = await this.getAccessToken();
    const records = this.findOwnedRecordsForDelete(input);
    if (!records.length) {
      throw new HttpError(404, "No active app-owned records matched the delete request");
    }

    const requestedCount = (input.names?.length ?? 0) + (input.clientRecordIds?.length ?? 0);
    if (requestedCount && records.length !== requestedCount) {
      throw new HttpError(403, "Delete requests may only target app-owned active Google Health records");
    }

    const dataTypes = [...new Set(records.map((record) => record.data_type))];
    const parentDataType = dataTypes.length === 1 ? dataTypes[0] : "-";
    const names = records.map((record) => record.google_name);
    const now = new Date().toISOString();

    for (const record of records) {
      this.sql`
        UPDATE owned_google_records
        SET status = 'pending_delete', operation_json = NULL, updated_at = ${now}
        WHERE id = ${record.id} AND status = 'active'
      `;
    }

    let operation: Operation;
    try {
      operation = await batchDeleteDataPoints(accessToken, parentDataType, names);
    } catch (error) {
      for (const record of records) {
        this.setDefinitiveRequestFailure(record.id, "pending_delete", "active", error);
      }
      throw error;
    }
    const status = operationRecordStatus(operation, "pending_delete");
    const completedAt = new Date().toISOString();
    for (const record of records) {
      this.sql`
        UPDATE owned_google_records
        SET status = ${status}, operation_json = ${JSON.stringify(operation)}, updated_at = ${completedAt}
        WHERE id = ${record.id} AND status = 'pending_delete'
      `;
    }
    throwIfOperationFailed(operation);

    return {
      operation,
      pending: status === "pending_delete",
      records: records.map((record) => publicLedgerRecord({ ...record, status, updated_at: completedAt }))
    };
  }

  private async reconcilePendingOperations(): Promise<Record<string, unknown>> {
    this.markStaleUntrackableOperations();
    const records = this.sql<LedgerRow>`
      SELECT * FROM owned_google_records
      WHERE status IN ('pending_create', 'pending_patch', 'pending_delete')
      ORDER BY updated_at ASC
      LIMIT 25
    `;
    if (!records.length || !this.state.google) {
      return { checked: 0, settled: 0 };
    }

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch (error) {
      return { checked: 0, error: errorMessage(error), settled: 0 };
    }

    const results = (
      await Promise.all(
        records.map(
          async (
            record
          ): Promise<{ id: string; observedStatus: LedgerStatus; operation: Operation; status: LedgerStatus } | undefined> => {
            const storedOperation = parseLedgerOperation(record.operation_json);
            if (!storedOperation?.name) {
              return undefined;
            }

            try {
              const operation = await getOperation(accessToken, storedOperation.name);
              if (operation.done !== true) {
                return undefined;
              }
              return {
                id: record.id,
                observedStatus: record.status,
                operation,
                status: operationRecordStatus(operation, record.status)
              };
            } catch {
              return undefined;
            }
          }
        )
      )
    ).filter(
      (
        result
      ): result is { id: string; observedStatus: LedgerStatus; operation: Operation; status: LedgerStatus } =>
        result !== undefined
    );

    const now = new Date().toISOString();
    for (const result of results) {
      this.sql`
        UPDATE owned_google_records
        SET status = ${result.status}, operation_json = ${JSON.stringify(result.operation)}, updated_at = ${now}
        WHERE id = ${result.id} AND status = ${result.observedStatus}
      `;
    }

    return { checked: records.length, settled: results.length };
  }

  private markStaleUntrackableOperations(): void {
    const cutoff = new Date(Date.now() - UNTRACKABLE_OPERATION_TIMEOUT_MS).toISOString();
    const now = new Date().toISOString();
    this.sql`
      UPDATE owned_google_records
      SET status = CASE status
        WHEN 'pending_create' THEN 'unknown_create'
        WHEN 'pending_patch' THEN 'unknown_patch'
        WHEN 'pending_delete' THEN 'unknown_delete'
      END,
      updated_at = ${now}
      WHERE operation_json IS NULL
        AND updated_at < ${cutoff}
        AND status IN ('pending_create', 'pending_patch', 'pending_delete')
    `;
  }

  private setDefinitiveRequestFailure(
    id: string,
    pendingStatus: LedgerStatus,
    restoredStatus: LedgerStatus,
    error: unknown
  ): void {
    if (!(error instanceof GoogleHealthApiError) || error.status >= 500) {
      return;
    }

    const now = new Date().toISOString();
    this.sql`
      UPDATE owned_google_records
      SET status = ${restoredStatus}, updated_at = ${now}
      WHERE id = ${id} AND status = ${pendingStatus} AND operation_json IS NULL
    `;
  }

  private findRecordByClientRecordId(dataType: string, clientRecordId: string): LedgerRow | undefined {
    const [record] = this.sql<LedgerRow>`
      SELECT * FROM owned_google_records
      WHERE data_type = ${dataType} AND client_record_id = ${clientRecordId}
      LIMIT 1
    `;
    return record;
  }

  private findOwnedRecord(
    dataType: string,
    input: {
      clientRecordId?: string;
      name?: string;
    }
  ): LedgerRow {
    const record = input.name
      ? this.sql<LedgerRow>`
          SELECT * FROM owned_google_records
          WHERE data_type = ${dataType} AND google_name = ${input.name} AND status = 'active'
          LIMIT 1
        `[0]
      : input.clientRecordId
        ? this.sql<LedgerRow>`
            SELECT * FROM owned_google_records
            WHERE data_type = ${dataType} AND client_record_id = ${input.clientRecordId} AND status = 'active'
            LIMIT 1
          `[0]
        : undefined;

    if (!record) {
      throw new HttpError(403, "This record is not an active app-owned Google Health record");
    }

    return record;
  }

  private findOwnedRecordsForDelete(input: {
    clientRecordIds?: string[];
    dataType?: string;
    names?: string[];
  }): LedgerRow[] {
    const names = stringArrayValue(input.names, "names");
    const clientRecordIds = stringArrayValue(input.clientRecordIds, "clientRecordIds");

    if (!names.length && !clientRecordIds.length) {
      throw new HttpError(400, "names or clientRecordIds are required");
    }

    const dataType = input.dataType ? requireDataType(input.dataType) : undefined;
    const records: LedgerRow[] = [];

    for (const name of names) {
      const [record] = dataType
        ? this.sql<LedgerRow>`
            SELECT * FROM owned_google_records
            WHERE data_type = ${dataType} AND google_name = ${name} AND status = 'active'
            LIMIT 1
          `
        : this.sql<LedgerRow>`
            SELECT * FROM owned_google_records
            WHERE google_name = ${name} AND status = 'active'
            LIMIT 1
          `;
      if (record) {
        records.push(record);
      }
    }

    for (const clientRecordId of clientRecordIds) {
      if (!dataType) {
        throw new HttpError(400, "dataType is required when deleting by clientRecordIds");
      }
      const [record] = this.sql<LedgerRow>`
        SELECT * FROM owned_google_records
        WHERE data_type = ${dataType} AND client_record_id = ${clientRecordId} AND status = 'active'
        LIMIT 1
      `;
      if (record) {
        records.push(record);
      }
    }

    return [...new Map(records.map((record) => [record.id, record])).values()];
  }
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true }, request, env);
      }

      if (request.method === "GET" && url.pathname === "/oauth/start") {
        await requireBearerAuth(request, env);
        return startOAuth(request, env);
      }

      if (request.method === "GET" && url.pathname === "/oauth/callback") {
        return handleOAuthCallback(request, env);
      }

      const routed = await routeAgentRequest(request, env);
      if (routed) {
        return withCors(routed, request, env);
      }

      throw new HttpError(404, "Not found");
    } catch (error) {
      return errorResponse(error, request, env);
    }
  }
};

async function startOAuth(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const returnTo = url.searchParams.get("returnTo")?.trim();

  if (!userId) {
    throw new HttpError(400, "userId is required");
  }
  if (returnTo && !isAllowedReturnTo(returnTo, env.ALLOWED_ORIGINS)) {
    throw new HttpError(400, "returnTo is not in ALLOWED_ORIGINS");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new HttpError(500, "GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be configured");
  }

  const state = await signJson(
    {
      createdAt: Date.now(),
      nonce: crypto.randomUUID(),
      returnTo,
      userId
    },
    oauthStateSecret(env)
  );
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("access_type", "offline");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("include_granted_scopes", "true");
  google.searchParams.set("prompt", "consent");
  google.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", AGENT_GOOGLE_HEALTH_SCOPES.join(" "));
  google.searchParams.set("state", state);

  return Response.redirect(google.toString(), 302);
}

async function handleOAuthCallback(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const stateToken = url.searchParams.get("state");

  if (!stateToken) {
    throw new HttpError(400, "state is required");
  }

  const state = parseOAuthState(await verifySignedJson(stateToken, oauthStateSecret(env), MAX_OAUTH_STATE_AGE_MS));
  if (error) {
    return oauthCompletionResponse(request, env, state, { error });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new HttpError(400, "code is required");
  }

  const token = await exchangeGoogleCode(env, code);
  const agent = await getAgentByName(env.FittyHealthAgent, state.userId);
  const connectUrl = new URL(`/agents/fitty-health-agent/${encodeURIComponent(state.userId)}/internal/connect-google`, url);
  const connectResponse = await agent.fetch(
    new Request(connectUrl, {
      body: JSON.stringify(token),
      headers: {
        "Content-Type": "application/json",
        "X-Fitty-Internal-Token": env.HEALTH_AGENT_API_TOKEN
      },
      method: "POST"
    })
  );

  if (!connectResponse.ok) {
    throw new HttpError(502, "Failed to connect Google Health token to agent", await connectResponse.text());
  }

  return oauthCompletionResponse(request, env, state, { connected: "1" });
}

function oauthCompletionResponse(
  request: Request,
  env: AppEnv,
  state: OAuthState,
  params: Record<string, string>
): Response {
  if (state.returnTo && isAllowedReturnTo(state.returnTo, env.ALLOWED_ORIGINS)) {
    const returnTo = new URL(state.returnTo);
    for (const [key, value] of Object.entries(params)) {
      returnTo.searchParams.set(key, value);
    }
    return Response.redirect(returnTo.toString(), 302);
  }

  return jsonResponse(params, request, env);
}

function oauthStateSecret(env: AppEnv): string {
  return env.OAUTH_STATE_SECRET || env.HEALTH_AGENT_API_TOKEN;
}

function parseStoredRefreshToken(value: unknown): StoredRefreshToken {
  if (!isRecord(value) || typeof value.refreshToken !== "string" || !value.refreshToken) {
    throw new HttpError(500, "Stored Google refresh token is invalid");
  }
  if (value.scope !== undefined && typeof value.scope !== "string") {
    throw new HttpError(500, "Stored Google scope is invalid");
  }
  if (value.tokenType !== undefined && typeof value.tokenType !== "string") {
    throw new HttpError(500, "Stored Google token type is invalid");
  }

  return {
    refreshToken: value.refreshToken,
    scope: value.scope,
    tokenType: value.tokenType
  };
}

function parseOAuthState(value: Record<string, unknown>): OAuthState {
  if (typeof value.createdAt !== "number" || typeof value.nonce !== "string" || typeof value.userId !== "string") {
    throw new HttpError(400, "OAuth state payload is invalid");
  }
  if (value.returnTo !== undefined && typeof value.returnTo !== "string") {
    throw new HttpError(400, "OAuth return URL is invalid");
  }

  return {
    createdAt: value.createdAt,
    nonce: value.nonce,
    returnTo: value.returnTo,
    userId: value.userId
  };
}

function agentSubpath(pathname: string): string {
  const match = pathname.match(/^\/agents\/fitty-health-agent\/[^/]+(\/.*)?$/);
  return match?.[1] ?? pathname;
}

function requireDataType(value: string | undefined): string {
  if (!value || !/^[a-z0-9-]+$/.test(value)) {
    throw new HttpError(400, "dataType must be a Google Health kebab-case data type");
  }
  return value;
}

async function normalizeClientRecordId(value: string | undefined): Promise<string> {
  if (value && /^[a-z0-9-]{4,63}$/.test(value)) {
    return value;
  }

  if (value) {
    return `fitty-${await stableHash(value)}`.slice(0, 63);
  }

  return `fitty-${crypto.randomUUID()}`;
}

function clampDays(value: number | undefined, defaultValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(Math.round(value), 1), 90);
}

function publicLedgerRecord(record: LedgerRow): Record<string, unknown> {
  return {
    clientRecordId: record.client_record_id,
    createdAt: record.created_at,
    dataType: record.data_type,
    googleName: record.google_name,
    id: record.id,
    status: record.status,
    updatedAt: record.updated_at
  };
}

function extractAiText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (isRecord(result)) {
    if (typeof result.response === "string") {
      return result.response;
    }
    if (typeof result.text === "string") {
      return result.text;
    }
    const choices = result.choices;
    if (Array.isArray(choices)) {
      const first = choices[0];
      const message = isRecord(first) && isRecord(first.message) ? first.message : undefined;
      if (typeof message?.content === "string") {
        return message.content;
      }
      if (isRecord(first) && typeof first.text === "string") {
        return first.text;
      }
    }
  }

  return JSON.stringify(result);
}

function operationRecordStatus(operation: Operation, pendingStatus: LedgerStatus): LedgerStatus {
  if (operation.done !== true) {
    return pendingStatus;
  }
  if (operation.error !== undefined) {
    return pendingStatus === "pending_create" ? "failed_create" : "active";
  }
  return pendingStatus === "pending_delete" ? "deleted" : "active";
}

function throwIfOperationFailed(operation: Operation): void {
  if (operation.done === true && operation.error !== undefined) {
    throw new GoogleHealthApiError(502, "Google Health operation failed", operation.error);
  }
}

function parseLedgerOperation(value: string | null): Operation | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return undefined;
    }
    return {
      done: typeof parsed.done === "boolean" ? parsed.done : undefined,
      error: parsed.error,
      name: typeof parsed.name === "string" ? parsed.name : undefined
    };
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Reconciliation failed";
}

function stringArrayValue(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new HttpError(400, `${fieldName} must be an array of non-empty strings`);
  }
  return value;
}
