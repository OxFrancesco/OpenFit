import { GoogleConnectionError, googleTokenForClerkUser } from "../../../shared/clerk-google";
import { Agent, routeAgentRequest } from "agents";

import { decryptJson, encryptJson, type EncryptedJson } from "./crypto";
import {
  buildAuthorizationUrl,
  connectionSummary,
  createOAuthTransaction,
  credentialNeedsRefresh,
  exchangeAuthorizationCode,
  FITNESS_PROVIDERS,
  generateFitnessOAuthCompletionId,
  parseFitnessOAuthCompleteInput,
  parseFitnessOAuthFinalizeInput,
  parseFitnessOAuthStartInput,
  parsePendingFitnessAuthorization,
  parseFitnessProvider,
  parseProviderCredential,
  refreshProviderCredential,
  revokeProviderCredential,
  verifyFitnessLinkChallenge
} from "./fitness-oauth";
import type {
  FitnessConnectionSummary,
  FitnessOAuthEnv,
  FitnessOAuthCompleteInput,
  FitnessOAuthFinalizeInput,
  FitnessOAuthPendingCompletion,
  FitnessOAuthStartInput,
  FitnessProvider,
  OAuthTransaction,
  ProviderCredential,
  StoredFitnessConnection
} from "./fitness-oauth";
import {
  fetchHealthContext,
  listDataPoints,
  refreshGoogleAccessToken,
  rollUpDataPoints
} from "./google-health";
import type { GoogleTokenResponse } from "./google-health";
import {
  emptyResponse,
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
  readJson,
  requireBearerAuth,
  requireInternalAuth,
  withCors
} from "./http";
import {
  parseAskInput,
  parseConnectInput,
  parseGoogleTokenResponse,
  parseListDataPointsInput,
  parseRollupInput,
  parseSnapshotInput
} from "./validation";
import { isWebSocketUpgrade } from "./request-security";
import type {
  AskInput,
  ListDataPointsInput,
  RollupInput,
  SnapshotInput
} from "./validation";

type StoredRefreshToken = {
  refreshToken: string;
  scope?: string;
  tokenType?: string;
};

type AppEnv = Env & FitnessOAuthEnv & {
  CLERK_SECRET_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  HEALTH_AGENT_API_TOKEN: string;
  TOKEN_ENCRYPTION_KEY: string;
};

type EncryptedFitnessConnection = Omit<StoredFitnessConnection, "credential"> & {
  credential: EncryptedJson;
};

type HealthAgentState = {
  fitness?: Partial<Record<FitnessProvider, EncryptedFitnessConnection>>;
  google?: {
    connectedAt: string;
    refreshToken?: EncryptedJson;
    clerkUserId?: string;
    scope?: string;
  };
};

type CoachMessageRow = {
  content: string;
  created_at: string;
  id: string;
  role: "assistant" | "user";
};

type OAuthTransactionRow = {
  code_verifier: string | null;
  expires_at: number;
  provider: FitnessProvider;
  redirect_uri: string;
  state: string;
};

type PendingOAuthCompletionRow = {
  authorization_ciphertext: string;
  authorization_iv: string;
  code_verifier: string | null;
  completion_id: string;
  expires_at: number;
  link_challenge: string;
  provider: FitnessProvider;
  redirect_uri: string;
};

const DEFAULT_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const COACH_MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const FITNESS_OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;

export class FittyHealthAgent extends Agent<AppEnv, HealthAgentState> {
  initialState: HealthAgentState = {};
  private stateMutationTail: Promise<void> = Promise.resolve();

  async onStart(): Promise<void> {
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
    this.sql`
      CREATE TABLE IF NOT EXISTS fitness_oauth_transactions (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('strava', 'garmin')),
        redirect_uri TEXT NOT NULL,
        code_verifier TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_fitness_oauth_transactions_expires_at
      ON fitness_oauth_transactions (expires_at)
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS fitness_oauth_pending_completions (
        completion_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('strava', 'garmin')),
        redirect_uri TEXT NOT NULL,
        code_verifier TEXT,
        link_challenge TEXT NOT NULL,
        authorization_ciphertext TEXT NOT NULL,
        authorization_iv TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_fitness_oauth_pending_expires_at
      ON fitness_oauth_pending_completions (expires_at)
    `;
    this.purgeExpiredOAuthPendingCompletions();
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, this.env);
    }

    try {
      const requestUrl = new URL(request.url);
      const path = agentSubpath(requestUrl.pathname);

      if (request.method === "POST" && path === "/internal/connect-google") {
        await requireInternalAuth(request, this.env);
        const body = parseGoogleTokenResponse(await readJson(request));
        return jsonResponse(await this.storeGoogleToken(body), request, this.env);
      }

      await requireBearerAuth(request, this.env);

      if (request.method === "GET" && path === "/status") {
        return jsonResponse(await this.status(), request, this.env);
      }

      if (request.method === "GET" && path === "/fitness/connections") {
        return jsonResponse({ connections: this.listFitnessConnections() }, request, this.env);
      }

      const oauthStart = path.match(/^\/fitness\/oauth\/([^/]+)\/start$/);
      if (request.method === "POST" && oauthStart) {
        const provider = parseFitnessProvider(oauthStart[1]);
        const body = parseFitnessOAuthStartInput(await readJson(request));
        return jsonResponse(await this.startFitnessOAuth(provider, body), request, this.env);
      }

      const oauthComplete = path.match(/^\/fitness\/oauth\/([^/]+)\/complete$/);
      if (request.method === "POST" && oauthComplete) {
        const provider = parseFitnessProvider(oauthComplete[1]);
        const body = parseFitnessOAuthCompleteInput(await readJson(request));
        return jsonResponse(await this.completeFitnessOAuth(provider, body), request, this.env);
      }

      const oauthFinalize = path.match(/^\/fitness\/oauth\/([^/]+)\/finalize$/);
      if (request.method === "POST" && oauthFinalize) {
        const provider = parseFitnessProvider(oauthFinalize[1]);
        const body = parseFitnessOAuthFinalizeInput(await readJson(request));
        return jsonResponse(await this.finalizeFitnessOAuth(provider, body), request, this.env);
      }

      const disconnect = path.match(/^\/fitness\/connections\/([^/]+)$/);
      if (request.method === "DELETE" && disconnect) {
        const provider = parseFitnessProvider(disconnect[1]);
        const forceLocal = requestUrl.searchParams.get("forceLocal") === "true";
        return jsonResponse(
          await this.disconnectFitnessProvider(provider, forceLocal),
          request,
          this.env
        );
      }

      if (request.method === "POST" && path === "/connect-clerk") {
        const body = await readJson(request);
        if (!isRecord(body) || typeof body.userId !== "string" || !body.userId.startsWith("user_")) {
          throw new HttpError(400, "Invalid account connection");
        }
        const token = await googleTokenForClerkUser(this.env.CLERK_SECRET_KEY, body.userId, this.name);
        await this.withStateMutation(async () => {
          this.setState({ ...this.state, google: {
            connectedAt: new Date().toISOString(),
            clerkUserId: token.clerkUserId,
            scope: token.scope
          } });
        });
        return jsonResponse({ connected: true }, request, this.env);
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

      throw new HttpError(404, "Not found");
    } catch (error) {
      return errorResponse(error instanceof GoogleConnectionError ? new HttpError(error.status, error.message) : error, request, this.env);
    }
  }

  private status(): Record<string, unknown> {
    return {
      connected: Boolean(this.state.google),
      googleScope: this.state.google?.scope,
      lastConnectedAt: this.state.google?.connectedAt
    };
  }

  private listFitnessConnections(): FitnessConnectionSummary[] {
    return FITNESS_PROVIDERS.map((provider) => this.fitnessConnectionSummary(provider));
  }

  private fitnessConnectionSummary(provider: FitnessProvider): FitnessConnectionSummary {
    const connection = this.state.fitness?.[provider];
    return connectionSummary(
      provider,
      this.env,
      connection
        ? {
            connectedAt: connection.connectedAt,
            externalAccountLabel: connection.externalAccountLabel,
            grantedScopes: connection.grantedScopes
          }
        : undefined
    );
  }

  private async startFitnessOAuth(
    provider: FitnessProvider,
    input: FitnessOAuthStartInput
  ): Promise<{ authorizationUrl: string }> {
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(503, "Secure fitness credential storage is not configured", {
        provider,
        unavailableReason: "not-configured"
      });
    }
    const transaction = await createOAuthTransaction(provider, input);
    const authorizationUrl = await buildAuthorizationUrl(transaction, this.env);
    const now = Date.now();
    this.purgeExpiredOAuthTransactions(now);
    this.purgeExpiredOAuthPendingCompletions(now);

    const existing = this.sql<{ state: string }>`
      SELECT state
      FROM fitness_oauth_transactions
      WHERE state = ${transaction.state}
      LIMIT 1
    `;
    if (existing.length) {
      throw new HttpError(409, "An OAuth transaction already exists for this state");
    }

    this.sql`
      INSERT INTO fitness_oauth_transactions (
        state,
        provider,
        redirect_uri,
        code_verifier,
        expires_at,
        created_at
      ) VALUES (
        ${transaction.state},
        ${transaction.provider},
        ${transaction.redirectUri},
        ${transaction.codeVerifier ?? null},
        ${transaction.expiresAt},
        ${now}
      )
    `;

    return { authorizationUrl };
  }

  private async completeFitnessOAuth(
    provider: FitnessProvider,
    input: FitnessOAuthCompleteInput
  ): Promise<FitnessOAuthPendingCompletion> {
    return this.withStateMutation(async () => {
      if (!this.env.TOKEN_ENCRYPTION_KEY) {
        throw new HttpError(503, "Secure fitness credential storage is not configured", {
          provider,
          unavailableReason: "not-configured"
        });
      }
      const transaction = this.consumeOAuthTransaction(provider, input.state);
      if (input.error) {
        throw new HttpError(400, `${provider === "strava" ? "Strava" : "Garmin"} authorization was not completed`);
      }
      if (!input.code) {
        throw new HttpError(400, "OAuth authorization code is missing");
      }

      const encryptedAuthorization = await encryptJson(
        {
          code: input.code,
          scope: input.scope,
          version: 1
        },
        this.env.TOKEN_ENCRYPTION_KEY
      );
      const completionId = generateFitnessOAuthCompletionId();
      const now = Date.now();
      const expiresAt = now + FITNESS_OAUTH_PENDING_TTL_MS;
      this.purgeExpiredOAuthPendingCompletions(now);
      this.sql`
        INSERT INTO fitness_oauth_pending_completions (
          completion_id,
          provider,
          redirect_uri,
          code_verifier,
          link_challenge,
          authorization_ciphertext,
          authorization_iv,
          expires_at,
          created_at
        ) VALUES (
          ${completionId},
          ${provider},
          ${transaction.redirectUri},
          ${transaction.codeVerifier ?? null},
          ${input.linkChallenge},
          ${encryptedAuthorization.ciphertext},
          ${encryptedAuthorization.iv},
          ${expiresAt},
          ${now}
        )
      `;

      return { completionId, provider, state: "pending" };
    });
  }

  private async finalizeFitnessOAuth(
    provider: FitnessProvider,
    input: FitnessOAuthFinalizeInput
  ): Promise<FitnessConnectionSummary> {
    return this.withStateMutation(async () => {
      if (!this.env.TOKEN_ENCRYPTION_KEY) {
        throw new HttpError(503, "Secure fitness credential storage is not configured", {
          provider,
          unavailableReason: "not-configured"
        });
      }

      const now = Date.now();
      this.purgeExpiredOAuthPendingCompletions(now);
      const pendingRows = this.sql<PendingOAuthCompletionRow>`
        SELECT
          completion_id,
          provider,
          redirect_uri,
          code_verifier,
          link_challenge,
          authorization_ciphertext,
          authorization_iv,
          expires_at
        FROM fitness_oauth_pending_completions
        WHERE completion_id = ${input.completionId}
          AND provider = ${provider}
          AND expires_at > ${now}
        LIMIT 1
      `;
      const pending = pendingRows[0];
      if (
        !pending ||
        !(await verifyFitnessLinkChallenge(input.linkVerifier, pending.link_challenge))
      ) {
        throw new HttpError(409, "Pending OAuth completion is missing, expired, already used, or invalid");
      }

      const consumeNow = Date.now();
      const consumedRows = this.sql<PendingOAuthCompletionRow>`
        DELETE FROM fitness_oauth_pending_completions
        WHERE completion_id = ${input.completionId}
          AND provider = ${provider}
          AND expires_at > ${consumeNow}
        RETURNING
          completion_id,
          provider,
          redirect_uri,
          code_verifier,
          link_challenge,
          authorization_ciphertext,
          authorization_iv,
          expires_at
      `;
      const consumed = consumedRows[0];
      if (!consumed) {
        throw new HttpError(409, "Pending OAuth completion is missing, expired, or already used");
      }

      const authorization = parsePendingFitnessAuthorization(
        await decryptJson(
          {
            ciphertext: consumed.authorization_ciphertext,
            iv: consumed.authorization_iv,
            version: 1
          },
          this.env.TOKEN_ENCRYPTION_KEY
        )
      );
      const transaction: OAuthTransaction = {
        codeVerifier: consumed.code_verifier ?? undefined,
        expiresAt: consumed.expires_at,
        provider: consumed.provider,
        redirectUri: consumed.redirect_uri,
        state: consumed.completion_id
      };
      const credential = await exchangeAuthorizationCode(
        transaction,
        authorization.code,
        authorization.scope,
        this.env
      );
      await this.storeFitnessConnectionUnlocked(credential);
      return this.fitnessConnectionSummary(provider);
    });
  }

  private consumeOAuthTransaction(provider: FitnessProvider, state: string): OAuthTransaction {
    const now = Date.now();
    const rows = this.sql<OAuthTransactionRow>`
      DELETE FROM fitness_oauth_transactions
      WHERE state = ${state}
        AND provider = ${provider}
        AND expires_at > ${now}
      RETURNING state, provider, redirect_uri, code_verifier, expires_at
    `;
    this.purgeExpiredOAuthTransactions(now);

    const row = rows[0];
    if (!row) {
      throw new HttpError(409, "OAuth transaction is missing, expired, or already used");
    }
    return {
      codeVerifier: row.code_verifier ?? undefined,
      expiresAt: row.expires_at,
      provider: row.provider,
      redirectUri: row.redirect_uri,
      state: row.state
    };
  }

  private purgeExpiredOAuthTransactions(now = Date.now()): void {
    this.sql`DELETE FROM fitness_oauth_transactions WHERE expires_at <= ${now}`;
  }

  private purgeExpiredOAuthPendingCompletions(now = Date.now()): void {
    this.sql`DELETE FROM fitness_oauth_pending_completions WHERE expires_at <= ${now}`;
  }

  private async storeFitnessConnectionUnlocked(
    credential: ProviderCredential,
    connectedAt = new Date().toISOString()
  ): Promise<void> {
    if (!this.env.TOKEN_ENCRYPTION_KEY) {
      throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
    }

    const connection: EncryptedFitnessConnection = {
      connectedAt,
      credential: await encryptJson(credential, this.env.TOKEN_ENCRYPTION_KEY),
      externalAccountLabel: credential.externalAccountLabel,
      grantedScopes: [...credential.grantedScopes]
    };
    this.setState({
      ...this.state,
      fitness: {
        ...this.state.fitness,
        [credential.provider]: connection
      }
    });
  }

  private async disconnectFitnessProvider(
    provider: FitnessProvider,
    forceLocal = false
  ): Promise<FitnessConnectionSummary> {
    return this.withStateMutation(async () => {
      const connection = this.state.fitness?.[provider];
      if (!connection) {
        return this.fitnessConnectionSummary(provider);
      }
      if (forceLocal) {
        return this.removeFitnessConnectionUnlocked(provider);
      }
      if (!this.env.TOKEN_ENCRYPTION_KEY) {
        throw new HttpError(500, "TOKEN_ENCRYPTION_KEY is not configured");
      }

      let credential = parseProviderCredential(
        await decryptJson(connection.credential, this.env.TOKEN_ENCRYPTION_KEY),
        provider
      );
      if (provider === "garmin" && credentialNeedsRefresh(credential)) {
        credential = await refreshProviderCredential(credential, this.env);
        await this.storeFitnessConnectionUnlocked(credential, connection.connectedAt);
      }
      await revokeProviderCredential(credential, this.env);

      return this.removeFitnessConnectionUnlocked(provider);
    });
  }

  private removeFitnessConnectionUnlocked(provider: FitnessProvider): FitnessConnectionSummary {
    const fitness = { ...this.state.fitness };
    delete fitness[provider];
    this.setState({ ...this.state, fitness });
    return this.fitnessConnectionSummary(provider);
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

    const encryptedRefreshToken = await encryptJson(stored, this.env.TOKEN_ENCRYPTION_KEY);
    await this.withStateMutation(async () => {
      this.setState({
        ...this.state,
        google: {
          connectedAt: new Date().toISOString(),
          refreshToken: encryptedRefreshToken,
          scope: token.scope
        }
      });
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
    if (this.state.google.clerkUserId) {
      return (await googleTokenForClerkUser(this.env.CLERK_SECRET_KEY, this.state.google.clerkUserId, this.name)).accessToken;
    }
    if (!this.env.TOKEN_ENCRYPTION_KEY || !this.state.google.refreshToken) {
      throw new HttpError(409, "Reconnect Google Health in Account");
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

  private async withStateMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.stateMutationTail;
    let release: () => void = () => {};
    this.stateMutationTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
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

}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    try {
      const url = new URL(request.url);

      if (isWebSocketUpgrade(request)) {
        throw new HttpError(404, "Not found");
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true }, request, env);
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

function clampDays(value: number | undefined, defaultValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(Math.round(value), 1), 90);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
