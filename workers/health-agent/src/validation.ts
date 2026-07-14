import type { GoogleTokenResponse } from "./google-health";
import { HttpError } from "./http";

export type AskInput = { days?: number; question: string };
export type ConnectInput = { refreshToken: string; scope?: string; tokenType?: string };
export type ListDataPointsInput = { dataType: string; filter?: string; pageSize?: number; pageToken?: string };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, expected: string): HttpError {
  return new HttpError(400, `${field} must be ${expected}`);
}
