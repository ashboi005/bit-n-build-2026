import { describe, expect, test } from "bun:test";

import { oauthAuthorizationReturn } from "./oauth-return";

describe("OAuth login return", () => {
  test("resumes only a signed authorization request after browser-app sign in", () => {
    expect(oauthAuthorizationReturn(
      "https://app.example.test/login?client_id=chrome&state=s&sig=signature&code_challenge=c",
      "https://api.example.test",
    )).toBe("https://api.example.test/api/auth/oauth2/authorize?client_id=chrome&state=s&sig=signature&code_challenge=c");
  });

  test("does not convert an ordinary login into an OAuth redirect", () => {
    expect(oauthAuthorizationReturn("https://app.example.test/login?next=%2F", "https://api.example.test")).toBeNull();
  });
});
