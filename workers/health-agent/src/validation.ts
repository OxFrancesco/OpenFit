import { HttpError } from "./http";

export type AskInput = { days?: number; question: string; deviceHealth?: DeviceContext };

export function parseAskInput(value: unknown): AskInput {
  const input = record(value);
  return {
    days: optionalNumber(input, "days"),
    question: requiredString(input, "question"),
    deviceHealth: parseDeviceContext(input.deviceHealth)
  };
}

function record(value: unknown, field = "body"): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalid(field, "a JSON object");
  }
  return value;
}

function requiredString(input: Record<string, unknown>, key: string, field = key): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw invalid(field, "a non-empty string");
  }
  return value;
}

function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalid(key, "a finite number");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, expected: string): HttpError {
  return new HttpError(400, `${field} must be ${expected}`);
}


type DeviceContext = { source: string; range: string; metrics: { id: string; label: string; unit: string; value: number | null }[]; sleepSessions: unknown[]; exercises: unknown[] };
function parseDeviceContext(value: unknown): DeviceContext | undefined {
  if (value === undefined) return undefined;
  const input = record(value, "deviceHealth");
  if (JSON.stringify(input).length > 24000) throw invalid("deviceHealth", "at most 24000 characters");
  if (input.source !== "Apple Health" && input.source !== "Health Connect") throw invalid("deviceHealth.source", "a device health source");
  const text = (obj: Record<string, unknown>, key: string) => {
    const value = requiredString(obj, key);
    if (value.length > 120) throw invalid(key, "at most 120 characters");
    return value;
  };
  const list = (key: string, max: number) => {
    const value = input[key];
    if (!Array.isArray(value) || value.length > max) throw invalid(key, `an array with at most ${max} items`);
    return value.map(item => record(item, key));
  };
  const nullableNumber = (obj: Record<string, unknown>, key: string) => obj[key] === null ? null : optionalNumber(obj, key) ?? null;
  return {
    source: input.source, range: text(input, "range"),
    metrics: list("metrics", 40).map(m => ({ id: text(m,"id"), label: text(m,"label"), unit: text(m,"unit"), value: nullableNumber(m,"value") })),
    sleepSessions: list("sleepSessions", 200).map(m => ({ startTime: text(m,"startTime"), endTime: text(m,"endTime"), minutesAsleep: nullableNumber(m,"minutesAsleep"), minutesInSleepPeriod: nullableNumber(m,"minutesInSleepPeriod") })),
    exercises: list("exercises", 200).map(m => ({ name: text(m,"name"), startTime: text(m,"startTime"), endTime: text(m,"endTime"), activeMinutes: nullableNumber(m,"activeMinutes") })),
  };
}
