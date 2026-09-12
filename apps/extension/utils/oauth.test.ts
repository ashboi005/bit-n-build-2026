import { describe, expect, test } from "bun:test";

import {
  ACCESS_TOKEN_TTL_MS,
  authorizationCodeFromCallback,
  OAUTH_SCOPES,
  buildAuthorizationUrl,
  shouldRefresh,
} from "./oauth";

describe("extension OAuth", () => {
  test("builds a PKCE authorization request with fixed callback, audience, and narrow scopes", () => {
    const url = new URL(
      buildAuthorizationUrl({
        apiOrigin: "https://staging-api.example.test",
        clientId: "chrome-private-alpha",
        extensionId: "abcdefghijklmnopabcdefghijklmnop",
        state: "state-value",
        codeChallenge: "challenge-value",
      }),
    );

    expect(url.pathname).toBe("/api/auth/oauth2/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2/callback",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(OAUTH_SCOPES.join(" "));
    expect(url.searchParams.get("resource")).toBe("https://staging-api.example.test");
  });

  test("refreshes absent or near-expiry tokens but never treats a stale token as valid", () => {
    expect(shouldRefresh(null, 1_000)).toBe(true);
    expect(shouldRefresh(1_000 + ACCESS_TOKEN_TTL_MS, 1_000)).toBe(false);
    expect(shouldRefresh(1_000 + 30_000, 1_000)).toBe(true);
  });

  test("accepts only the exact Chromium callback with the matching state", () => {
    expect(authorizationCodeFromCallback({
      callbackUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2/callback?state=expected&code=code-123",
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      state: "expected",
    })).toBe("code-123");

    expect(() => authorizationCodeFromCallback({
      callbackUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/other?state=expected&code=code-123",
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      state: "expected",
    })).toThrow("callback was rejected");
    expect(() => authorizationCodeFromCallback({
      callbackUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2/callback?state=wrong&code=code-123",
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      state: "expected",
    })).toThrow("state did not match");
    expect(() => authorizationCodeFromCallback({
      callbackUrl: "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2/callback?state=expected&error=invalid_target&error_description=client%20is%20not%20linked",
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      state: "expected",
    })).toThrow("Sign-in failed: invalid_target — client is not linked");
  });
});
