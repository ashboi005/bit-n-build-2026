import { describe, expect, test } from "bun:test";

import { extensionRedirectUri, extensionTrustedOrigin, oauthProviderOptions } from "./extension-oauth";

describe("extension OAuth policy", () => {
  const config = {
    BETTER_AUTH_URL: "https://api.staging.example.test",
    CORS_ORIGIN: "https://app.staging.example.test",
    EXTENSION_API_AUDIENCE: "https://api.staging.example.test",
    EXTENSION_CHROME_CLIENT_ID: "chrome-private-alpha",
    EXTENSION_CHROME_ID: "abcdefghijklmnopabcdefghijklmnop",
  };

  test("pins the Chromium callback and trusted extension origin to one extension", () => {
    expect(extensionRedirectUri(config.EXTENSION_CHROME_ID)).toBe(
      "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth2/callback",
    );
    expect(extensionTrustedOrigin(config.EXTENSION_CHROME_ID)).toBe(
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    );
  });

  test("issues short-lived, audience-bound tokens with only the thesis scope", () => {
    expect(oauthProviderOptions(config)).toMatchObject({
      scopes: ["openid", "offline_access", "thesis:run"],
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 604800,
      cachedTrustedClients: new Set(["chrome-private-alpha"]),
    });
    expect(oauthProviderOptions(config).resources).toEqual([
      {
        identifier: "https://api.staging.example.test",
        accessTokenTtl: 900,
        allowedScopes: ["thesis:run"],
      },
    ]);
  });
});
