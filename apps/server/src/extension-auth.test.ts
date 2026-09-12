import { describe, expect, test } from "bun:test";

import { bearerToken, isAllowedBrowserOrigin, oauthSubject } from "./extension-auth";

describe("extension authentication boundary", () => {
  test("accepts only one well-formed bearer credential", () => {
    expect(bearerToken(new Headers({ Authorization: "Bearer access-token" }))).toBe("access-token");
    expect(bearerToken(new Headers({ Authorization: "Basic value" }))).toBeNull();
    expect(bearerToken(new Headers({ Authorization: "Bearer " }))).toBeNull();
  });

  test("requires a string OAuth subject before mapping to a product profile", () => {
    expect(oauthSubject({ sub: "user_123" })).toBe("user_123");
    expect(oauthSubject({ sub: ["user_123"] })).toBeNull();
    expect(oauthSubject({})).toBeNull();
  });

  test("allows only the browser app and one exact extension origin", () => {
    const app = "https://staging.mindovermoney.app";
    const extension = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org";
    expect(isAllowedBrowserOrigin(app, app, extension)).toBe(true);
    expect(isAllowedBrowserOrigin(extension, app, extension)).toBe(true);
    expect(isAllowedBrowserOrigin("chrome-extension://untrusted", app, extension)).toBe(false);
    expect(isAllowedBrowserOrigin("https://evil.example", app, extension)).toBe(false);
    expect(isAllowedBrowserOrigin(null, app, extension)).toBe(false);
  });
});
