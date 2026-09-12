import type { StreamEvent } from "@bit-n-build-2026/contracts";
import { browser } from "wxt/browser";
import type { Browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { buildDraft, sanitizeSelection } from "../utils/page-context";
import {
  ACCESS_TOKEN_TTL_MS,
  authorizationCodeFromCallback,
  buildAuthorizationUrl,
  extensionRedirectUri,
  pkceChallenge,
  randomBase64Url,
  shouldRefresh,
} from "../utils/oauth";
import { isTrustedExtensionSender } from "../utils/message-security";

const API_ORIGIN = (import.meta.env.WXT_API_ORIGIN ?? "").replace(/\/$/, "");
const OAUTH_CLIENT_ID = import.meta.env.WXT_OAUTH_CLIENT_ID ?? "";
const EXTENSION_ID = import.meta.env.WXT_EXTENSION_ID || browser.runtime.id || "";
const PORT_NAME = "mind-over-money-side-panel";
const MAX_QUERY_CHARS = 2_000;

type AccessSession = { accessToken: string; accessExpiresAt: number };
type RefreshSession = { refreshToken: string; refreshExpiresAt: number };
type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

function assertOAuthConfig(): void {
  if (!API_ORIGIN || !OAUTH_CLIENT_ID || !EXTENSION_ID) {
    throw new Error("Extension OAuth configuration is incomplete.");
  }
}

function apiUrl(path: string): string {
  assertOAuthConfig();
  return `${API_ORIGIN}${path}`;
}

async function readVisibleSelection(tabId: number): Promise<{
  hostname: string;
  selectedText: string;
  visibleText: string;
}> {
  const [injected] = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selection = window.getSelection();
      const node = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
      const selectedElement = node?.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node?.parentElement;
      const hasSensitiveAncestor = Boolean(selectedElement?.closest(
        "input, textarea, select, [contenteditable], [type='hidden'], [hidden], [aria-hidden='true']",
      ));
      const selectedText = hasSensitiveAncestor ? "" : (selection?.toString() ?? "");
      const heading = document.querySelector("h1, [role='heading']")?.textContent ?? "";
      // Only a tiny, rendered page label is kept locally for the Groww adapter.
      const visibleText = `${heading} ${document.title}`.replace(/\s+/g, " ").trim().slice(0, 300);
      return { hostname: window.location.hostname, selectedText, visibleText };
    },
  });

  if (!injected?.result) throw new Error("Could not read the current selection.");
  return injected.result;
}

async function saveAccess(tokens: TokenResponse): Promise<void> {
  const accessExpiresAt = Date.now() + (tokens.expires_in ?? ACCESS_TOKEN_TTL_MS / 1_000) * 1_000;
  await browser.storage.session.set({
    access: { accessToken: tokens.access_token, accessExpiresAt } satisfies AccessSession,
  });

  if (tokens.refresh_token) {
    await browser.storage.local.set({
      refresh: {
        refreshToken: tokens.refresh_token,
        refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1_000,
      } satisfies RefreshSession,
    });
  }
}

async function refreshAccess(): Promise<AccessSession> {
  const { refresh } = await browser.storage.local.get("refresh");
  const stored = refresh as RefreshSession | undefined;
  if (!stored || stored.refreshExpiresAt <= Date.now()) {
    await browser.storage.local.remove("refresh");
    throw new Error("Sign in again to continue.");
  }

  const response = await fetch(apiUrl("/api/auth/oauth2/token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: OAUTH_CLIENT_ID,
      refresh_token: stored.refreshToken,
      resource: API_ORIGIN,
    }),
  });
  if (!response.ok) throw new Error("Sign in again to continue.");

  await saveAccess((await response.json()) as TokenResponse);
  const { access } = await browser.storage.session.get("access");
  return access as AccessSession;
}

async function accessForUserAction(): Promise<AccessSession> {
  const { access } = await browser.storage.session.get("access");
  const stored = access as AccessSession | undefined;
  if (stored && !shouldRefresh(stored.accessExpiresAt)) return stored;
  return refreshAccess();
}

async function signIn(): Promise<void> {
  assertOAuthConfig();
  const verifier = randomBase64Url(48);
  const state = randomBase64Url(32);
  const authorizationUrl = buildAuthorizationUrl({
    apiOrigin: API_ORIGIN,
    clientId: OAUTH_CLIENT_ID,
    extensionId: EXTENSION_ID,
    state,
    codeChallenge: await pkceChallenge(verifier),
  });
  const callbackUrl = await browser.identity.launchWebAuthFlow({ url: authorizationUrl, interactive: true });
  if (!callbackUrl) throw new Error("Sign-in was cancelled.");

  const code = authorizationCodeFromCallback({ callbackUrl, extensionId: EXTENSION_ID, state });

  const response = await fetch(apiUrl("/api/auth/oauth2/token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: OAUTH_CLIENT_ID,
      code,
      redirect_uri: extensionRedirectUri(EXTENSION_ID),
      code_verifier: verifier,
      resource: API_ORIGIN,
    }),
  });
  if (!response.ok) throw new Error("Sign-in token exchange failed.");
  await saveAccess((await response.json()) as TokenResponse);
}

async function signOut(): Promise<void> {
  const { refresh } = await browser.storage.local.get("refresh");
  const stored = refresh as RefreshSession | undefined;
  if (stored) {
    await fetch(apiUrl("/api/auth/oauth2/revoke"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        token: stored.refreshToken,
        token_type_hint: "refresh_token",
      }),
    }).catch(() => undefined);
  }
  await Promise.all([browser.storage.session.clear(), browser.storage.local.remove("refresh")]);
}

async function streamThesis(query: string, port: Browser.runtime.Port): Promise<void> {
  const safeQuery = sanitizeSelection(query);
  if (!safeQuery || safeQuery.length > MAX_QUERY_CHARS) {
    throw new Error("Enter a short claim without a URL or portfolio data.");
  }
  const { accessToken } = await accessForUserAction();
  const response = await fetch(apiUrl("/api/thesis/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: safeQuery }),
  });
  if (!response.ok || !response.body) throw new Error(`Investigation failed (${response.status}).`);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((entry) => entry.startsWith("data: "));
      if (!line) continue;
      port.postMessage({ type: "event", event: JSON.parse(line.slice(6)) as StreamEvent });
    }
  }
}

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    if (!tab.id) return;
    const tabId = tab.id;

    // Must be invoked before any await so Chrome still considers this a toolbar gesture.
    void browser.sidePanel.open({ tabId }).catch(() => undefined);
    void (async () => {
      try {
        await browser.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true });
        const context = await readVisibleSelection(tabId);
        const draft = buildDraft(context);
        await browser.storage.session.set({ draft });
      } catch {
        await browser.storage.session.remove("draft");
      }
    })();
  });

  browser.runtime.onConnect.addListener((port) => {
    if (
      port.name !== PORT_NAME ||
      !port.sender ||
      !isTrustedExtensionSender(port.sender.id, browser.runtime.id)
    ) {
      return;
    }

    port.onMessage.addListener(async (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const payload = message as { type?: unknown; query?: unknown };
      try {
        if (payload.type === "draft") {
          const { draft } = await browser.storage.session.get("draft");
          port.postMessage({ type: "draft", draft: draft ?? null });
        } else if (payload.type === "login") {
          await signIn();
          port.postMessage({ type: "signed-in" });
        } else if (payload.type === "logout") {
          await signOut();
          port.postMessage({ type: "signed-out" });
        } else if (payload.type === "run" && typeof payload.query === "string") {
          await streamThesis(payload.query, port);
          port.postMessage({ type: "completed" });
        }
      } catch (error) {
        port.postMessage({ type: "error", message: error instanceof Error ? error.message : "Request failed." });
      }
    });
  });
});
