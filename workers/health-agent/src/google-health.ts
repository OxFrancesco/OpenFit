export const GOOGLE_HEALTH_BASE_URL = "https://health.googleapis.com/v4";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleTokenEnv = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export type GoogleHealthDataPoint = Record<string, unknown> & {
  name?: string;
};

export type ListDataPointsResponse = {
  dataPoints?: GoogleHealthDataPoint[];
  nextPageToken?: string;
};

export class GoogleHealthApiError extends Error {
  readonly details?: unknown;
  readonly status: number;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "GoogleHealthApiError";
    this.status = status;
    this.details = details;
  }
}

export async function refreshGoogleAccessToken(
  env: GoogleTokenEnv,
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  return googleTokenFetch(body);
}

export async function googleHealthFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${GOOGLE_HEALTH_BASE_URL}/${path.replace(/^\/+/, "")}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw await googleError(response);
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

export async function listDataPoints(
  accessToken: string,
  dataType: string,
  options: {
    filter?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<ListDataPointsResponse> {
  const query = new URLSearchParams();
  if (options.filter) {
    query.set("filter", options.filter);
  }
  if (options.pageSize) {
    query.set("pageSize", String(options.pageSize));
  }
  if (options.pageToken) {
    query.set("pageToken", options.pageToken);
  }

  const value = requireJsonObject(
    await googleHealthFetch(accessToken, `users/me/dataTypes/${dataType}/dataPoints${query.size ? `?${query}` : ""}`),
    "Google Health list response"
  );
  const dataPoints = value.dataPoints;
  const nextPageToken = value.nextPageToken;

  if (dataPoints !== undefined && (!Array.isArray(dataPoints) || dataPoints.some((item) => !isJsonObject(item)))) {
    throw new GoogleHealthApiError(502, "Google Health returned an invalid data point list", value);
  }
  if (nextPageToken !== undefined && typeof nextPageToken !== "string") {
    throw new GoogleHealthApiError(502, "Google Health returned an invalid page token", value);
  }

  return { dataPoints, nextPageToken };
}

export async function rollUpDataPoints(
  accessToken: string,
  dataType: string,
  options: {
    endTime: string;
    pageSize?: number;
    startTime: string;
    windowSize?: string;
  }
): Promise<Record<string, unknown>> {
  return requireJsonObject(
    await googleHealthFetch(accessToken, `users/me/dataTypes/${dataType}/dataPoints:rollUp`, {
      body: JSON.stringify({
        pageSize: options.pageSize ?? 1000,
        range: {
          endTime: options.endTime,
          startTime: options.startTime
        },
        windowSize: options.windowSize ?? "86400s"
      }),
      method: "POST"
    }),
    "Google Health rollup response"
  );
}

export async function fetchHealthContext(
  accessToken: string,
  options: {
    days?: number;
    now?: Date;
  } = {}
): Promise<Record<string, unknown>> {
  const now = options.now ?? new Date();
  const days = Math.min(Math.max(Math.round(options.days ?? 30), 1), 90);
  const endTime = now.toISOString();
  const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const shortRangeStartTime = new Date(now.getTime() - Math.min(days, 14) * 24 * 60 * 60 * 1000).toISOString();

  const rollupTypes = [
    "steps",
    "distance",
    "active-energy-burned",
    "active-minutes",
    "active-zone-minutes",
    "total-calories",
    "heart-rate",
    "weight"
  ];

  const rollups = Object.fromEntries(
    await Promise.all(
      rollupTypes.map(async (dataType) => [
        dataType,
        await settledValue(() =>
          rollUpDataPoints(accessToken, dataType, {
            endTime,
            startTime: dataType === "heart-rate" || dataType === "active-minutes" ? shortRangeStartTime : startTime
          })
        )
      ])
    )
  );

  const sleepFilter = `sleep.interval.end_time >= "${startTime}" AND sleep.interval.end_time < "${endTime}"`;
  const exerciseFilter = `exercise.interval.start_time >= "${startTime}" AND exercise.interval.start_time < "${endTime}"`;
  const weightFilter = `weight.sample_time.physical_time >= "${startTime}" AND weight.sample_time.physical_time < "${endTime}"`;

  return {
    generatedAt: now.toISOString(),
    range: {
      days,
      endTime,
      startTime
    },
    raw: {
      exercise: await settledValue(() => listDataPoints(accessToken, "exercise", { filter: exerciseFilter, pageSize: 25 })),
      recentWeight: await settledValue(() => listDataPoints(accessToken, "weight", { filter: weightFilter, pageSize: 25 })),
      sleep: await settledValue(() => listDataPoints(accessToken, "sleep", { filter: sleepFilter, pageSize: 25 }))
    },
    rollups
  };
}

async function googleTokenFetch(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw await googleError(response);
  }

  const value = requireJsonObject(await response.json(), "Google OAuth token response");
  if (typeof value.access_token !== "string" || !value.access_token) {
    throw new GoogleHealthApiError(502, "Google OAuth returned an invalid access token response", value);
  }

  return {
    access_token: value.access_token,
    expires_in: optionalNumber(value.expires_in, "expires_in", value),
    refresh_token: optionalString(value.refresh_token, "refresh_token", value),
    scope: optionalString(value.scope, "scope", value),
    token_type: optionalString(value.token_type, "token_type", value)
  };
}

async function googleError(response: Response): Promise<GoogleHealthApiError> {
  const text = await response.text();
  let details: unknown = text;
  let message = text || response.statusText;

  try {
    const parsed: unknown = JSON.parse(text);
    details = parsed;
    if (isJsonObject(parsed)) {
      const nestedError = isJsonObject(parsed.error) ? parsed.error : undefined;
      message =
        (typeof nestedError?.message === "string" ? nestedError.message : undefined) ??
        (typeof parsed.error_description === "string" ? parsed.error_description : undefined) ??
        message;
    }
  } catch {
    details = text;
  }

  return new GoogleHealthApiError(response.status, message, details);
}

function requireJsonObject(value: unknown, context: string): Record<string, unknown> {
  if (!isJsonObject(value)) {
    throw new GoogleHealthApiError(502, `${context} was not a JSON object`, value);
  }
  return value;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown, field: string, details: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GoogleHealthApiError(502, `Google OAuth returned an invalid ${field}`, details);
  }
  return value;
}

function optionalString(value: unknown, field: string, details: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new GoogleHealthApiError(502, `Google OAuth returned an invalid ${field}`, details);
  }
  return value;
}

async function settledValue<T>(task: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await task();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Request failed" };
  }
}
