import { createAuth as createConfiguredAuth } from "@bit-n-build-2026/auth";
import { type Database, createDb } from "@bit-n-build-2026/db";

import { env } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
  return db;
}
export const auth = createConfiguredAuth(env, db);
