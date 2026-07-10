const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export type PendingGoogleOAuth = {
  createdAt: number;
  state: string;
};

export function createPendingGoogleOAuth(state: string): PendingGoogleOAuth {
  return { createdAt: Date.now(), state };
}

export function parsePendingGoogleOAuth(raw: string): PendingGoogleOAuth | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.state !== 'string' || !value.state) {
      return null;
    }
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) {
      return null;
    }
    if (Date.now() - value.createdAt > PENDING_MAX_AGE_MS) {
      return null;
    }

    return { createdAt: value.createdAt, state: value.state };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
