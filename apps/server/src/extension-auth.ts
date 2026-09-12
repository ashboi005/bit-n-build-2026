export function bearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  const match = value?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function oauthSubject(payload: { sub?: unknown }): string | null {
  return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
}

export function isAllowedBrowserOrigin(
  origin: string | null,
  browserOrigin: string,
  extensionOrigin: string,
): boolean {
  return origin === browserOrigin || origin === extensionOrigin;
}
