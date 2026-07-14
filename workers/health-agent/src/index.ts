import { Agent, routeAgentRequest } from "agents";

import { decryptJson, encryptJson, type EncryptedJson } from "./crypto";
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

type AppEnv = Env & {
  GOOGLE_CLIENT_SECRET: string;
  HEALTH_AGENT_API_TOKEN: string;
  TOKEN_ENCRYPTION_KEY: string;
};

type HealthAgentState = {
  google?: {
    connectedAt: string;
    refreshToken: EncryptedJson;
    scope?: string;
  };
};

type CoachMessageRow = {
  content: string;
  created_at: string;
  id: string;
  role: "assistant" | "user";
};

const DEFAULT_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const COACH_MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class FittyHealthAgent extends Agent<AppEnv, HealthAgentState> {
  initialState: HealthAgentState = {};

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

      throw new HttpError(404, "Not found");
    } catch (error) {
      return errorResponse(error, request, this.env);
    }
  }

  private status(): Record<string, unknown> {
    return {
      connected: Boolean(this.state.google),
      googleScope: this.state.google?.scope,
      lastConnectedAt: this.state.google?.connectedAt
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
