export const EXTENSION_SCOPES = ["openid", "offline_access", "thesis:run"] as const;

export type ExtensionOAuthConfig = {
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
  EXTENSION_API_AUDIENCE: string;
  EXTENSION_CHROME_CLIENT_ID: string;
  EXTENSION_CHROME_ID: string;
};

export function extensionRedirectUri(extensionId: string): string {
  return `https://${extensionId}.chromiumapp.org/oauth2/callback`;
}

export function extensionTrustedOrigin(extensionId: string): string {
  return `chrome-extension://${extensionId}`;
}

/** OAuth 2.1 policy for the single, pre-registered Chrome private-alpha client. */
export function oauthProviderOptions(config: ExtensionOAuthConfig) {
  return {
    scopes: [...EXTENSION_SCOPES],
    resources: [
      {
        identifier: config.EXTENSION_API_AUDIENCE,
        accessTokenTtl: 15 * 60,
        allowedScopes: ["thesis:run"],
      },
    ],
    cachedTrustedClients: new Set([config.EXTENSION_CHROME_CLIENT_ID]),
    accessTokenExpiresIn: 15 * 60,
    refreshTokenExpiresIn: 7 * 24 * 60 * 60,
    refreshTokenReuseInterval: 0,
    enforcePerClientResources: true,
  };
}
