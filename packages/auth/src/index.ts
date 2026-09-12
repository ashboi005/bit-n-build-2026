import type { Database } from "@bit-n-build-2026/db";
import * as schema from "@bit-n-build-2026/db/schema";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";

import { extensionTrustedOrigin, oauthProviderOptions, type ExtensionOAuthConfig } from "./extension-oauth";

export type AuthConfig = ExtensionOAuthConfig & {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
};

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = [],
) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      extensionTrustedOrigin(env.EXTENSION_CHROME_ID),
      ...desktopOrigins,
    ],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      jwt({
        jwt: {
          issuer: `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/api/auth`,
          audience: env.EXTENSION_API_AUDIENCE,
          expirationTime: "15m",
        },
      }),
      oauthProvider({
        ...oauthProviderOptions(env),
        loginPage: new URL("/login", env.CORS_ORIGIN).toString(),
        consentPage: new URL("/oauth/consent", env.CORS_ORIGIN).toString(),
      }),
    ],
  });
}
