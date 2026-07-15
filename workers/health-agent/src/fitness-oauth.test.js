import { describe, expect, test } from "bun:test";

import {
  buildAuthorizationUrl,
  connectionSummary,
  createOAuthTransaction,
  exchangeAuthorizationCode,
  generateFitnessOAuthCompletionId,
  generatePkcePair,
  hashFitnessLinkVerifier,
  parseFitnessOAuthCompleteInput,
  parseFitnessOAuthFinalizeInput,
  parseFitnessOAuthStartInput,
  parsePendingFitnessAuthorization,
  providerUnavailableReason,
  refreshProviderCredential,
  revokeProviderCredential,
  STRAVA_AUTHORIZATION_URL,
  STRAVA_REVOKE_URL,
  STRAVA_TOKEN_URL,
  verifyFitnessLinkChallenge
} from "./fitness-oauth";

const GARMIN_AUTHORIZATION_URL = "https://partner.example/garmin/authorize";
const GARMIN_TOKEN_URL = "https://partner.example/garmin/token";
const GARMIN_USER_ID_URL = "https://partner.example/garmin/user-id";
const GARMIN_PERMISSIONS_URL = "https://partner.example/garmin/permissions";
const GARMIN_DISCONNECT_URL = "https://partner.example/garmin/disconnect";
const LINK_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const LINK_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const configuredEnv = {
  GARMIN_AUTHORIZATION_URL,
  GARMIN_CLIENT_ID: "garmin-client",
  GARMIN_CLIENT_SECRET: "garmin-secret",
  GARMIN_DISCONNECT_URL,
  GARMIN_PARTNER_APPROVED: "true",
  GARMIN_PERMISSIONS_URL,
  GARMIN_TOKEN_URL,
  GARMIN_USER_ID_URL,
  STRAVA_CLIENT_ID: "12345",
  STRAVA_CLIENT_SECRET: "strava-secret",
  STRAVA_POLICY_APPROVED: "true",
  STRAVA_WEBHOOK_READY: "true",
  TOKEN_ENCRYPTION_KEY: "test-token-encryption-key-32-bytes"
};

describe("fitness OAuth validation and availability", () => {
  test("validates state, completion/finalize shapes, and safe redirect URIs", () => {
    expect(
      parseFitnessOAuthStartInput({
        redirectUri: "https://fitty.example/api/fitness/callback",
        state: "a-secure-random-state"
      })
    ).toEqual({
      redirectUri: "https://fitty.example/api/fitness/callback",
      state: "a-secure-random-state"
    });
    expect(
      parseFitnessOAuthCompleteInput({
        code: "one-time-code",
        linkChallenge: LINK_CHALLENGE,
        scope: "read,activity:read",
        state: "a-secure-random-state"
      })
    ).toEqual({
      code: "one-time-code",
      error: undefined,
      linkChallenge: LINK_CHALLENGE,
      scope: "read,activity:read",
      state: "a-secure-random-state"
    });
    expect(
      parseFitnessOAuthFinalizeInput({
        completionId: "A".repeat(43),
        linkVerifier: LINK_VERIFIER
      })
    ).toEqual({
      completionId: "A".repeat(43),
      linkVerifier: LINK_VERIFIER
    });
    expect(() =>
      parseFitnessOAuthStartInput({ redirectUri: "fitty://oauth", state: "a-secure-random-state" })
    ).toThrow("redirectUri must use HTTPS");
    expect(() =>
      parseFitnessOAuthCompleteInput({
        code: "code",
        error: "denied",
        linkChallenge: LINK_CHALLENGE,
        state: "a-secure-random-state"
      })
    ).toThrow("Exactly one");
    expect(() =>
      parseFitnessOAuthCompleteInput({
        code: "code",
        linkChallenge: "not-a-sha256-challenge",
        state: "a-secure-random-state"
      })
    ).toThrow("linkChallenge");
    expect(() =>
      parseFitnessOAuthFinalizeInput({
        completionId: "A".repeat(43),
        linkVerifier: "too-short"
      })
    ).toThrow("linkVerifier");
    expect(
      parsePendingFitnessAuthorization({ code: "one-time-code", scope: "read", version: 1 })
    ).toEqual({ code: "one-time-code", scope: "read", version: 1 });
    expect(() =>
      parsePendingFitnessAuthorization({ code: "one-time-code", version: 2 })
    ).toThrow("Stored pending");
  });

  test("hashes and verifies the client-held link verifier", async () => {
    expect(await hashFitnessLinkVerifier(LINK_VERIFIER)).toBe(LINK_CHALLENGE);
    expect(await verifyFitnessLinkChallenge(LINK_VERIFIER, LINK_CHALLENGE)).toBeTrue();
    expect(await verifyFitnessLinkChallenge(LINK_VERIFIER, "A".repeat(43))).toBeFalse();

    const completionId = generateFitnessOAuthCompletionId();
    expect(completionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("reports provider gates without exposing configuration", () => {
    expect(providerUnavailableReason("strava", {})).toBe("not-configured");
    expect(
      providerUnavailableReason("strava", {
        STRAVA_CLIENT_ID: "id",
        STRAVA_CLIENT_SECRET: "secret",
        STRAVA_POLICY_APPROVED: "false",
        TOKEN_ENCRYPTION_KEY: "test-token-encryption-key-32-bytes"
      })
    ).toBe("policy-disabled");
    expect(
      providerUnavailableReason("strava", {
        STRAVA_CLIENT_ID: "id",
        STRAVA_CLIENT_SECRET: "secret",
        STRAVA_POLICY_APPROVED: "true",
        STRAVA_WEBHOOK_READY: "false",
        TOKEN_ENCRYPTION_KEY: "test-token-encryption-key-32-bytes"
      })
    ).toBe("policy-disabled");
    expect(
      providerUnavailableReason("garmin", {
        ...configuredEnv,
        GARMIN_PARTNER_APPROVED: undefined
      })
    ).toBe("approval-required");
    expect(
      providerUnavailableReason("garmin", {
        ...configuredEnv,
        GARMIN_AUTHORIZATION_URL: "http://partner.example/authorize"
      })
    ).toBe("not-configured");
    expect(connectionSummary("garmin", configuredEnv)).toEqual({
      grantedScopes: [],
      provider: "garmin",
      state: "disconnected"
    });
  });
});

describe("fitness OAuth authorization", () => {
  test("builds the minimal Strava authorization request", async () => {
    const transaction = await createOAuthTransaction(
      "strava",
      { redirectUri: "https://fitty.example/callback", state: "a-secure-random-state" },
      1_000
    );
    expect(transaction.codeVerifier).toBeUndefined();
    expect(transaction.expiresAt).toBe(601_000);

    const url = new URL(await buildAuthorizationUrl(transaction, configuredEnv));
    expect(url.origin + url.pathname).toBe(STRAVA_AUTHORIZATION_URL);
    expect(url.searchParams.get("client_id")).toBe("12345");
    expect(url.searchParams.get("redirect_uri")).toBe("https://fitty.example/callback");
    expect(url.searchParams.get("scope")).toBe("read");
    expect(url.searchParams.get("state")).toBe("a-secure-random-state");
  });

  test("generates and sends Garmin S256 PKCE", async () => {
    const pair = await generatePkcePair();
    expect(pair.verifier).toHaveLength(43);
    expect(pair.challenge).toHaveLength(43);
    expect(pair.challenge).not.toBe(pair.verifier);

    const transaction = await createOAuthTransaction("garmin", {
      redirectUri: "https://fitty.example/callback",
      state: "a-secure-random-state"
    });
    const url = new URL(await buildAuthorizationUrl(transaction, configuredEnv));
    expect(url.origin + url.pathname).toBe(GARMIN_AUTHORIZATION_URL);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
  });
});

describe("fitness OAuth provider adapters", () => {
  test("exchanges a Strava code and requires all minimal scopes", async () => {
    const requests = [];
    const fetchImpl = mockFetch((url, init) => {
      requests.push({ init, url });
      return Response.json({
        access_token: "strava-access",
        athlete: { firstname: "Ada", id: 42, lastname: "Lovelace" },
        expires_at: 2_000_000_000,
        refresh_token: "strava-refresh",
        scope: "read",
        token_type: "Bearer"
      });
    });
    const transaction = await createOAuthTransaction("strava", {
      redirectUri: "https://fitty.example/callback",
      state: "a-secure-random-state"
    });

    const credential = await exchangeAuthorizationCode(
      transaction,
      "strava-code",
      "read",
      configuredEnv,
      fetchImpl
    );
    expect(credential).toMatchObject({
      accessToken: "strava-access",
      externalAccountId: "42",
      externalAccountLabel: "Ada Lovelace",
      grantedScopes: ["read"],
      provider: "strava",
      refreshToken: "strava-refresh",
      version: 1
    });
    expect(requests[0].url).toBe(STRAVA_TOKEN_URL);
    expect(String(requests[0].init?.body)).not.toContain("redirect_uri=");

    const missingScopeFetch = mockFetch(() =>
      Response.json({
        access_token: "access",
        athlete: { id: 42 },
        refresh_token: "refresh",
        scope: ""
      })
    );
    await expect(
      exchangeAuthorizationCode(transaction, "code", "read", configuredEnv, missingScopeFetch)
    ).rejects.toMatchObject({ status: 409 });

    const callbackInflationFetch = mockFetch(() =>
      Response.json({
        access_token: "access",
        athlete: { id: 42 },
        refresh_token: "refresh",
        scope: "read"
      })
    );
    await expect(
      exchangeAuthorizationCode(
        transaction,
        "code",
        "read,activity:read",
        configuredEnv,
        callbackInflationFetch
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  test("uses Garmin PKCE, then resolves the immutable user id and permissions", async () => {
    const requests = [];
    const fetchImpl = mockFetch((url, init) => {
      requests.push({ init, url });
      if (url === GARMIN_TOKEN_URL) {
        return Response.json({
          access_token: "garmin-access",
          expires_in: 3600,
          refresh_token: "garmin-refresh",
          token_type: "Bearer"
        });
      }
      if (url === GARMIN_USER_ID_URL) {
        return Response.json({ userId: "immutable-garmin-id" });
      }
      if (url === GARMIN_PERMISSIONS_URL) {
        return Response.json(["ACTIVITY_EXPORT", "HEALTH_EXPORT"]);
      }
      return new Response(null, { status: 404 });
    });
    const transaction = await createOAuthTransaction("garmin", {
      redirectUri: "https://fitty.example/callback",
      state: "a-secure-random-state"
    });
    const credential = await exchangeAuthorizationCode(
      transaction,
      "garmin-code",
      undefined,
      configuredEnv,
      fetchImpl
    );

    expect(credential).toMatchObject({
      externalAccountId: "immutable-garmin-id",
      grantedScopes: ["ACTIVITY_EXPORT", "HEALTH_EXPORT"],
      provider: "garmin"
    });
    const tokenRequest = requests.find((request) => request.url === GARMIN_TOKEN_URL);
    expect(String(tokenRequest?.init?.body)).toContain("code_verifier=");
    expect(String(tokenRequest?.init?.body)).toContain("client_id=garmin-client");
    expect(String(tokenRequest?.init?.body)).toContain("client_secret=garmin-secret");
    expect(new Headers(tokenRequest?.init?.headers).get("Authorization")).toBeNull();
  });

  test("preserves the newest rotated refresh token", async () => {
    const credential = stravaCredential();
    const refreshed = await refreshProviderCredential(
      credential,
      configuredEnv,
      mockFetch(() =>
        Response.json({
          access_token: "new-access",
          expires_at: 2_000_000_000,
          refresh_token: "newest-refresh"
        })
      )
    );
    expect(refreshed.accessToken).toBe("new-access");
    expect(refreshed.refreshToken).toBe("newest-refresh");
    expect(refreshed.grantedScopes).toEqual(credential.grantedScopes);
  });

  test("refreshes Garmin with the documented client credentials form fields", async () => {
    let tokenRequest;
    const credential = {
      ...stravaCredential(),
      externalAccountId: "garmin-id",
      grantedScopes: ["ACTIVITY_EXPORT"],
      provider: "garmin"
    };
    const refreshed = await refreshProviderCredential(
      credential,
      configuredEnv,
      mockFetch((_url, init) => {
        tokenRequest = init;
        return Response.json({
          access_token: "new-garmin-access",
          expires_in: 3600,
          refresh_token: "new-garmin-refresh"
        });
      })
    );

    const body = String(tokenRequest?.body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=refresh-token");
    expect(body).toContain("client_id=garmin-client");
    expect(body).toContain("client_secret=garmin-secret");
    expect(new Headers(tokenRequest?.headers).get("Authorization")).toBeNull();
    expect(refreshed.refreshToken).toBe("new-garmin-refresh");
  });

  test("revokes Strava with Basic client authentication and Garmin by registration deletion", async () => {
    const requests = [];
    const fetchImpl = mockFetch((url, init) => {
      requests.push({ init, url });
      return new Response(null, { status: 200 });
    });

    await revokeProviderCredential(
      stravaCredential(),
      { ...configuredEnv, STRAVA_POLICY_APPROVED: "false" },
      fetchImpl
    );
    await revokeProviderCredential(
      {
        ...stravaCredential(),
        externalAccountId: "garmin-id",
        provider: "garmin"
      },
      configuredEnv,
      fetchImpl
    );

    expect(requests[0].url).toBe(STRAVA_REVOKE_URL);
    expect(new Headers(requests[0].init?.headers).get("Authorization")).toMatch(/^Basic /);
    expect(String(requests[0].init?.body)).toBe("token=refresh-token&token_type_hint=refresh_token");
    expect(requests[1]).toMatchObject({
      init: { method: "DELETE" },
      url: GARMIN_DISCONNECT_URL
    });
    expect(new Headers(requests[1].init?.headers).get("Authorization")).toBe("Bearer access-token");
  });
});

function stravaCredential() {
  return {
    accessToken: "access-token",
    expiresAt: Date.now() + 3_600_000,
    externalAccountId: "42",
    externalAccountLabel: "Ada Lovelace",
    grantedScopes: ["read"],
    provider: "strava",
    refreshToken: "refresh-token",
    tokenType: "Bearer",
    version: 1
  };
}

function mockFetch(handler) {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return handler(url, init);
  };
}
