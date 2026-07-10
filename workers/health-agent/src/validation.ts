import type {
  ExerciseDataPointInput,
  GoogleHealthDataPoint,
  GoogleTokenResponse,
  SleepDataPointInput,
  StepsDataPointInput,
  WeightDataPointInput
} from "./google-health";
import { HttpError } from "./http";

export type AskInput = { days?: number; question: string };
export type ConnectInput = { refreshToken: string; scope?: string; tokenType?: string };
export type CreateOwnedInput = { clientRecordId?: string; dataPoint: GoogleHealthDataPoint; dataType: string };
export type DeleteOwnedInput = { clientRecordIds?: string[]; dataType?: string; names?: string[] };
export type ListDataPointsInput = { dataType: string; filter?: string; pageSize?: number; pageToken?: string };
export type PatchOwnedInput = CreateOwnedInput & { name?: string };
export type RollupInput = {
  dataType: string;
  endTime: string;
  pageSize?: number;
  startTime: string;
  windowSize?: string;
};
export type SnapshotInput = { days?: number };

export function parseGoogleTokenResponse(value: unknown): GoogleTokenResponse {
  const input = record(value);
  return {
    access_token: optionalString(input, "access_token") ?? "",
    expires_in: optionalNumber(input, "expires_in"),
    refresh_token: optionalString(input, "refresh_token"),
    scope: optionalString(input, "scope"),
    token_type: optionalString(input, "token_type")
  };
}

export function parseConnectInput(value: unknown): ConnectInput {
  const input = record(value);
  return {
    refreshToken: requiredString(input, "refreshToken"),
    scope: optionalString(input, "scope"),
    tokenType: optionalString(input, "tokenType")
  };
}

export function parseAskInput(value: unknown): AskInput {
  const input = record(value);
  return {
    days: optionalNumber(input, "days"),
    question: requiredString(input, "question")
  };
}

export function parseSnapshotInput(value: unknown): SnapshotInput {
  const input = record(value);
  return { days: optionalNumber(input, "days") };
}

export function parseListDataPointsInput(value: unknown): ListDataPointsInput {
  const input = record(value);
  return {
    dataType: requiredString(input, "dataType"),
    filter: optionalString(input, "filter"),
    pageSize: optionalPositiveInteger(input, "pageSize"),
    pageToken: optionalString(input, "pageToken")
  };
}

export function parseRollupInput(value: unknown): RollupInput {
  const input = record(value);
  return {
    dataType: requiredString(input, "dataType"),
    endTime: requiredString(input, "endTime"),
    pageSize: optionalPositiveInteger(input, "pageSize"),
    startTime: requiredString(input, "startTime"),
    windowSize: optionalString(input, "windowSize")
  };
}

export function parseCreateOwnedInput(value: unknown): CreateOwnedInput {
  const input = record(value);
  return {
    clientRecordId: optionalString(input, "clientRecordId"),
    dataPoint: requiredRecord(input, "dataPoint"),
    dataType: requiredString(input, "dataType")
  };
}

export function parsePatchOwnedInput(value: unknown): PatchOwnedInput {
  const input = record(value);
  return {
    clientRecordId: optionalString(input, "clientRecordId"),
    dataPoint: requiredRecord(input, "dataPoint"),
    dataType: requiredString(input, "dataType"),
    name: optionalString(input, "name")
  };
}

export function parseDeleteOwnedInput(value: unknown): DeleteOwnedInput {
  const input = record(value);
  return {
    clientRecordIds: optionalStringArray(input, "clientRecordIds"),
    dataType: optionalString(input, "dataType"),
    names: optionalStringArray(input, "names")
  };
}

export function parseWeightInput(value: unknown): WeightDataPointInput {
  const input = record(value);
  return {
    clientRecordId: optionalString(input, "clientRecordId"),
    measuredAt: optionalString(input, "measuredAt"),
    notes: optionalString(input, "notes"),
    utcOffset: optionalString(input, "utcOffset"),
    weightGrams: optionalNumber(input, "weightGrams"),
    weightKg: optionalNumber(input, "weightKg")
  };
}

export function parseStepsInput(value: unknown): StepsDataPointInput {
  const input = record(value);
  return {
    clientRecordId: optionalString(input, "clientRecordId"),
    count: requiredNumber(input, "count"),
    endTime: requiredString(input, "endTime"),
    endUtcOffset: optionalString(input, "endUtcOffset"),
    startTime: requiredString(input, "startTime"),
    startUtcOffset: optionalString(input, "startUtcOffset")
  };
}

export function parseSleepInput(value: unknown): SleepDataPointInput {
  const input = record(value);
  const type = optionalString(input, "type");
  if (type !== undefined && type !== "CLASSIC" && type !== "STAGES" && type !== "SLEEP_TYPE_UNSPECIFIED") {
    throw invalid("type", "CLASSIC, STAGES, or SLEEP_TYPE_UNSPECIFIED");
  }

  return {
    clientRecordId: optionalString(input, "clientRecordId"),
    endTime: requiredString(input, "endTime"),
    endUtcOffset: optionalString(input, "endUtcOffset"),
    stages: optionalStages(input.stages),
    startTime: requiredString(input, "startTime"),
    startUtcOffset: optionalString(input, "startUtcOffset"),
    type
  };
}

export function parseExerciseInput(value: unknown): ExerciseDataPointInput {
  const input = record(value);
  return {
    activeDurationSeconds: optionalNumber(input, "activeDurationSeconds"),
    caloriesKcal: optionalNumber(input, "caloriesKcal"),
    clientRecordId: optionalString(input, "clientRecordId"),
    displayName: requiredString(input, "displayName"),
    distanceMeters: optionalNumber(input, "distanceMeters"),
    endTime: requiredString(input, "endTime"),
    endUtcOffset: optionalString(input, "endUtcOffset"),
    exerciseType: optionalString(input, "exerciseType"),
    notes: optionalString(input, "notes"),
    startTime: requiredString(input, "startTime"),
    startUtcOffset: optionalString(input, "startUtcOffset"),
    steps: optionalNumber(input, "steps")
  };
}

function optionalStages(value: unknown): SleepDataPointInput["stages"] {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw invalid("stages", "an array");
  }

  return value.map((stage, index) => {
    const input = record(stage, `stages[${index}]`);
    return {
      endTime: requiredString(input, "endTime", `stages[${index}].endTime`),
      endUtcOffset: optionalString(input, "endUtcOffset", `stages[${index}].endUtcOffset`),
      startTime: requiredString(input, "startTime", `stages[${index}].startTime`),
      startUtcOffset: optionalString(input, "startUtcOffset", `stages[${index}].startUtcOffset`),
      type: requiredString(input, "type", `stages[${index}].type`)
    };
  });
}

function record(value: unknown, field = "body"): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalid(field, "a JSON object");
  }
  return value;
}

function requiredRecord(input: Record<string, unknown>, key: string): Record<string, unknown> {
  return record(input[key], key);
}

function requiredString(input: Record<string, unknown>, key: string, field = key): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw invalid(field, "a non-empty string");
  }
  return value;
}

function optionalString(input: Record<string, unknown>, key: string, field = key): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalid(field, "a string");
  }
  return value;
}

function requiredNumber(input: Record<string, unknown>, key: string): number {
  const value = optionalNumber(input, key);
  if (value === undefined) {
    throw invalid(key, "a finite number");
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

function optionalPositiveInteger(input: Record<string, unknown>, key: string): number | undefined {
  const value = optionalNumber(input, key);
  if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 10_000)) {
    throw invalid(key, "an integer from 1 to 10000");
  }
  return value;
}

function optionalStringArray(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw invalid(key, "an array of non-empty strings");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, expected: string): HttpError {
  return new HttpError(400, `${field} must be ${expected}`);
}
