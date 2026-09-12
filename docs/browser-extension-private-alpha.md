# Browser extension private alpha

This is an invited, staging-only Chrome extension for reviewing an investment thesis. It
does not place trades and does not provide a recommendation to buy or sell.

## What leaves the browser

Only the plain-language draft that the user reviews and confirms is sent to Mind Over
Money. The server investigates that query using its cited source pipeline. A tiny visible
page label and the current selected text are held locally only long enough to suggest the
draft. They are page context, not evidence.

The extension does **not** send or store page URLs, full page HTML, screenshots, cookies,
broker logins, holdings, balances, orders, hidden fields, or browser history. Operational
logging is limited to adapter ID, extension version, success or failure, latency, and the
source layer that answered; it must never include selected text or page contents.

## Permissions

The alpha requests only `activeTab`, `scripting`, `sidePanel`, `storage`, and `identity`,
plus the exact staging API host. It does not request `<all_urls>`, `tabs`, `cookies`,
`webRequest`, screenshots, or remote code permissions. All extension logic is packaged
with the build and the extension CSP allows scripts only from itself.

## Staging setup and installation

1. Set `EXTENSION_API_AUDIENCE`, `EXTENSION_CHROME_CLIENT_ID`, and
   `EXTENSION_CHROME_ID` in the server environment. The Chrome ID must be the stable ID
   derived from the alpha extension key.
2. Apply the database migration `0003_massive_korvac.sql`, then run
   `bun run --filter @bit-n-build-2026/server oauth:provision` once against staging. This
   registers the exact Chromium callback and resource audience; it does not create a
   client dynamically at runtime.
3. Copy `apps/extension/.env.example` to the alpha environment, set the staging API,
   registered client ID, Chrome extension ID, and stable WXT extension key.
4. Build with `bun run --filter @bit-n-build-2026/extension build`, then load the generated
   `apps/extension/.output/chrome-mv3` folder as an unpacked extension for local testing.
   Invited testers receive the unlisted Chrome Web Store build after acceptance.

## Login, tokens, logout, and deletion

Sign-in opens Mind Over Money's normal secure login page. The extension never asks for a
broker login. It uses authorization code + PKCE, checks state and the exact callback, and
keeps the access token in session storage for 15 minutes. Its rotating refresh token is
kept in extension-only local storage and expires after seven days. Refresh happens only
when the user starts an investigation.

Signing out revokes the refresh token when reachable and clears both token stores. Removing
the extension clears local extension storage. Account deletion follows the existing Mind
Over Money account-deletion process; server-side history remains governed by that product
policy, not by a broker page.

## Known limitations and release gate

Groww is only a local draft helper, and arbitrary pages work from user-selected text. DOM
changes may stop automatic ticker suggestions, but never trigger a broader page capture.
This is not a public production release until a security review, privacy disclosure,
staging OAuth provisioning, Chrome end-to-end tests, and invited-alpha acceptance have
all passed.
