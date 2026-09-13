import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig } from "wxt";

const envFile = new URL(".env", import.meta.url);
const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const buildEnv = { ...fileEnv, ...process.env };
const apiOrigin = (buildEnv.WXT_API_ORIGIN ?? "https://thwip-api.ashwathsoni.dev").replace(
  /\/$/,
  "",
);

export default defineConfig({
  manifest: {
    name: "THWIP — Private Alpha",
    description: "Review an investment thesis with citable evidence.",
    minimum_chrome_version: "116",
    permissions: ["activeTab", "scripting", "sidePanel", "storage", "identity"],
    host_permissions: [`${apiOrigin}/*`],
    action: { default_title: "Analyze with THWIP" },
    side_panel: { default_path: "sidepanel.html" },
    ...(buildEnv.WXT_EXTENSION_KEY ? { key: buildEnv.WXT_EXTENSION_KEY } : {}),
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'",
    },
  },
});
