export const OAUTH_SCOPES = ["openid", "offline_access", "thesis:run"] as const;
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1_000;
const REFRESH_SKEW_MS = 60 * 1_000;

export function extensionRedirectUri(extensionId: string): string {
  return `https://${extensionId}.chromiumapp.org/oauth2/callback`;
}

export function authorizationCodeFromCallback({
  callbackUrl,
  extensionId,
  state,
}: {
  callbackUrl: string;
  extensionId: string;
  state: string;
}): string {
  const callback = new URL(callbackUrl);
  const expected = new URL(extensionRedirectUri(extensionId));
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) {
    throw new Error("Sign-in callback was rejected.");
  }
  if (callback.searchParams.get("state") !== state) {
    throw new Error("Sign-in state did not match.");
  }
  const error = callback.searchParams.get("error");
  if (error) {
    const description = callback.searchParams.get("error_description");
    throw new Error(`Sign-in failed: ${error}${description ? ` — ${description}` : ""}`);
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("Sign-in did not return an authorization code.");
  return code;
}

export function buildAuthorizationUrl(input: {
  apiOrigin: string;
  clientId: string;
  extensionId: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("/api/auth/oauth2/authorize", input.apiOrigin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", extensionRedirectUri(input.extensionId));
  url.searchParams.set("scope", OAUTH_SCOPES.join(" "));
  url.searchParams.set("resource", input.apiOrigin);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function shouldRefresh(accessExpiresAt: number | null, now = Date.now()): boolean {
  return accessExpiresAt === null || accessExpiresAt - now <= REFRESH_SKEW_MS;
}

export function randomBase64Url(bytes = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0"))
    .join("")
    .replace(/=/g, "");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
