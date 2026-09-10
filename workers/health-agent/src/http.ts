import { secureEqual } from "./crypto";

export class HttpError extends Error {
  readonly details?: unknown;
  readonly status: number;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

type CorsEnv = {
  ALLOWED_ORIGINS?: string;
  HEALTH_AGENT_API_TOKEN?: string;
  HEALTH_AGENT_CLERK_API_TOKEN?: string;
};

async function requireBridgeToken(token: string | undefined, env: CorsEnv): Promise<void> {
  const expected = [env.HEALTH_AGENT_API_TOKEN, env.HEALTH_AGENT_CLERK_API_TOKEN]
    .filter((value): value is string => Boolean(value));
  if (!expected.length) throw new HttpError(500, "Agent authentication is not configured");
  const matches = await Promise.all(expected.map(value => secureEqual(token, value)));
  if (!matches.some(Boolean)) throw new HttpError(401, "Unauthorized");
}

export async function requireBearerAuth(request: Request, env: CorsEnv): Promise<void> {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  await requireBridgeToken(token, env);
}

export async function requireInternalAuth(request: Request, env: CorsEnv): Promise<void> {
  await requireBridgeToken(request.headers.get("X-Fitty-Internal-Token") ?? undefined, env);
}

export async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > 1_048_576) {
    throw new HttpError(413, "JSON body is too large");
  }

  try {
    return request.json();
  } catch {
    throw new HttpError(400, "Expected a JSON request body");
  }
}

export function jsonResponse(data: unknown, request: Request, env: CorsEnv, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return withCors(Response.json(data, { ...init, headers }), request, env);
}

export function emptyResponse(request: Request, env: CorsEnv, status = 204): Response {
  return withCors(new Response(null, { status }), request, env);
}

export function errorResponse(error: unknown, request: Request, env: CorsEnv): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        details: error.details,
        error: error.message
      },
      request,
      env,
      { status: error.status }
    );
  }

  if (hasStatus(error)) {
    return jsonResponse(
      {
        details: error.details,
        error: error.message || "Health request failed"
      },
      request,
      env,
      { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
    );
  }

  return jsonResponse({ error: "Internal server error" }, request, env, { status: 500 });
}

export function handleOptions(request: Request, env: CorsEnv): Response {
  return withCors(new Response(null, { status: 204 }), request, env);
}

export function withCors(response: Response, request: Request, env: CorsEnv): Response {
  const origin = request.headers.get("Origin");
  const allowedOrigin = allowedCorsOrigin(origin, env.ALLOWED_ORIGINS);
  const headers = new Headers(response.headers);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Access-Control-Allow-Credentials", "false");
    headers.append("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Fitty-Internal-Token");
  headers.set("Access-Control-Allow-Methods", "DELETE, GET, OPTIONS, POST");
  headers.set("Access-Control-Max-Age", "86400");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

function allowedCorsOrigin(origin: string | null, allowedOrigins: string | undefined): string | undefined {
  if (!origin) {
    return undefined;
  }

  const allowed = parseAllowedOrigins(allowedOrigins);
  if (allowed.includes("*")) {
    return origin;
  }

  return allowed.includes(origin) ? origin : undefined;
}

function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function hasStatus(error: unknown): error is { details?: unknown; message?: string; status: number } {
  return isRecord(error) && typeof error.status === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
