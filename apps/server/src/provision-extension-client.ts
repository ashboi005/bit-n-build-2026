/** Run once per staging database after applying the OAuth migration. */
import { oauthClient, oauthClientResource, oauthResource } from "@bit-n-build-2026/db/schema/oauth";
import { and, eq } from "drizzle-orm";

import { env } from "./env.server";
import { getDb } from "./services";

const db = getDb();
const redirectUri = `https://${env.EXTENSION_CHROME_ID}.chromiumapp.org/oauth2/callback`;
const now = new Date();

const existingClient = await db.query.oauthClient.findFirst({
  where: eq(oauthClient.clientId, env.EXTENSION_CHROME_CLIENT_ID),
});

if (existingClient && (
  existingClient.tokenEndpointAuthMethod !== "none" ||
  existingClient.applicationType !== "native" ||
  !existingClient.requirePKCE ||
  existingClient.redirectUris.length !== 1 ||
  existingClient.redirectUris[0] !== redirectUri
)) {
  throw new Error("Existing Chrome OAuth client does not match the locked private-alpha policy.");
}

const client = existingClient ?? (await db.insert(oauthClient).values({
  id: crypto.randomUUID(),
  clientId: env.EXTENSION_CHROME_CLIENT_ID,
  name: "Mind Over Money Chrome Private Alpha",
  redirectUris: [redirectUri],
  scopes: ["openid", "offline_access", "thesis:run"],
  grantTypes: ["authorization_code", "refresh_token"],
  responseTypes: ["code"],
  tokenEndpointAuthMethod: "none",
  applicationType: "native",
  requirePKCE: true,
  skipConsent: true,
  createdAt: now,
  updatedAt: now,
}).returning())[0]!;

const existingResource = await db.query.oauthResource.findFirst({
  where: eq(oauthResource.identifier, env.EXTENSION_API_AUDIENCE),
});
const resource = existingResource ?? (await db.insert(oauthResource).values({
  id: crypto.randomUUID(),
  identifier: env.EXTENSION_API_AUDIENCE,
  name: "Mind Over Money thesis API",
  accessTokenTtl: 15 * 60,
  allowedScopes: ["thesis:run"],
  createdAt: now,
  updatedAt: now,
}).returning())[0]!;

const linked = await db.query.oauthClientResource.findFirst({
  where: and(eq(oauthClientResource.clientId, client.clientId), eq(oauthClientResource.resourceId, resource.identifier)),
});
if (!linked) {
  await db.insert(oauthClientResource).values({
    id: crypto.randomUUID(), clientId: client.clientId, resourceId: resource.identifier, createdAt: now,
  });
}

console.log(`Provisioned Chrome OAuth client ${client.clientId} for ${env.EXTENSION_API_AUDIENCE}.`);
