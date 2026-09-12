/**
 * Every outbound request goes through here: caching, polite rate limiting,
 * retries, and the per-host headers these undocumented endpoints demand.
 */

import { cached } from "./cache";

/**
 * Minimum gap between requests to the same host.
 * screener.in gets a full second — it's a small free site and it's our backbone.
 */
const HOST_DELAY_MS: Record<string, number> = {
  "www.screener.in": 1000,
  "api.bseindia.com": 350,
  "www.nseindia.com": 500,
  default: 200,
};

const lastRequestAt = new Map<string, number>();

async function politeDelay(host: string) {
  const gap = HOST_DELAY_MS[host] ?? HOST_DELAY_MS.default!;
  const last = lastRequestAt.get(host) ?? 0;
  const wait = last + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt.set(host, Date.now());
}

const BROWSERISH_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Per-host headers. These are not optional decoration.
 *
 * ⚠️ BSE: without Referer + Origin, api.bseindia.com 301-redirects to an
 * unrelated HTML page. You get a silent WRONG ANSWER, not an error. Always
 * assert on the response shape after parsing.
 */
function headersFor(host: string): Record<string, string> {
  if (host === "api.bseindia.com") {
    return {
      Referer: "https://www.bseindia.com/",
      Origin: "https://www.bseindia.com",
      "User-Agent": BROWSERISH_UA,
      Accept: "application/json, text/plain, */*",
    };
  }
  if (host.endsWith("nseindia.com")) {
    return {
      "User-Agent": BROWSERISH_UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.nseindia.com/",
    };
  }
  return { "User-Agent": BROWSERISH_UA, Accept: "*/*" };
}

export class FetchFailed extends Error {
  constructor(readonly url: string, readonly status: number) {
    super(`${url} -> ${status}`);
    this.name = "FetchFailed";
  }
}

async function rawGet(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const host = new URL(url).host;
  await politeDelay(host);

  const res = await fetch(url, {
    headers: { ...headersFor(host), ...extraHeaders },
    redirect: "manual", // a redirect here means we lost our headers — see BSE note
  });

  if (res.status >= 300 && res.status < 400) {
    throw new FetchFailed(url, res.status);
  }
  if (!res.ok) throw new FetchFailed(url, res.status);
  return res;
}

/** Cached JSON GET. Use for every JSON endpoint. */
export async function getJson<T>(url: string, ttlMs?: number): Promise<T> {
  return cached(`json_${url}`, async () => (await rawGet(url)).json() as Promise<T>, ttlMs);
}

/** Cached text GET. Use for HTML pages, CSV and RSS. */
export async function getText(url: string, ttlMs?: number): Promise<string> {
  return cached(`text_${url}`, async () => (await rawGet(url)).text(), ttlMs);
}

/**
 * NSE needs a cookie bootstrap before its API will answer.
 *
 * ⚠️ Even with cookies, `/api/quote-equity` returns 403 from datacenter IPs and
 * cannot be fixed. Use BSE for live quotes. This bootstrap is only useful for
 * the endpoints that DO work: corporate-announcements, corporateActions,
 * marketStatus, allIndices.
 */
let nseCookie: string | null = null;

export async function nseBootstrap(symbol = "RELIANCE"): Promise<string> {
  if (nseCookie) return nseCookie;
  const res = await fetch(`https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`, {
    headers: headersFor("www.nseindia.com"),
  });
  nseCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return nseCookie;
}

export async function getNseJson<T>(url: string, ttlMs?: number): Promise<T> {
  return cached(
    `json_${url}`,
    async () => {
      const cookie = await nseBootstrap();
      const res = await rawGet(url, { Cookie: cookie });
      return res.json() as Promise<T>;
    },
    ttlMs,
  );
}
