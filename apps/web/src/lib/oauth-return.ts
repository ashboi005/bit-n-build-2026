/** Returns the signed authorization request only when a login was OAuth-initiated. */
export function oauthAuthorizationReturn(loginUrl: string, serverUrl: string): string | null {
  const source = new URL(loginUrl);
  if (!source.searchParams.has("client_id") || !source.searchParams.has("sig")) return null;
  const destination = new URL("/api/auth/oauth2/authorize", serverUrl);
  destination.search = source.search;
  return destination.toString();
}
