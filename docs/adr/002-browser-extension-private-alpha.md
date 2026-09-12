# ADR 002: Browser extension private alpha

**Status:** Accepted — private alpha only

## Decision

Mind Over Money will ship a Chrome-first Manifest V3 extension as a private alpha.
The toolbar action opens a side panel. It reads only text the user selected and a short,
rendered page label used locally to suggest a draft. The user must review and edit that
draft before it is sent to the existing thesis stream.

Groww is the first local convenience adapter. It can suggest a company or ticker from the
small visible label, but it is not a broker integration. Any other page uses the selected
text and editable draft path.

The extension never collects or submits page URLs, full HTML, screenshots, cookies,
broker credentials, holdings, balances, orders, hidden form values, or tab history. Page
context is temporary, local, and clearly labelled as context rather than evidence.

The server remains the evidence boundary: library first, then the committed 20-stock
snapshot for missing fields, then fresh citable cache records. If those layers do not
provide verified coverage, the investigation returns the existing no-coverage state. The
extension does not make a live market-data request.

## Authentication and authorization

Better Auth's OAuth provider issues JWT resource tokens to one pre-registered public
Chrome client. The client has an exact Chromium callback, PKCE, state validation, the
staging API audience, and only `openid`, `offline_access`, and `thesis:run` scopes.

The background service worker owns authorization-code exchange, refresh, revocation, API
requests, and SSE parsing. A 15-minute access token lives in extension session storage; a
rotating refresh token lives only in extension local storage for no more than seven days.
Content scripts and the side panel never receive a token. The API accepts either its
existing Better Auth cookie session or a resource token with the required audience and
`thesis:run` scope, mapping both to the same user ID and existing history.

Trusted origins are the normal browser app and one exact Chromium callback origin. They
are not wildcard Chrome extension origins.

## Consequences

- A browser page can suggest a query but can never become evidence on its own.
- Changing broker DOMs can reduce draft quality but cannot expose broker data; the generic
  selected-text flow continues to work.
- The OAuth migration and the one-time client provisioning command must run in the staging
  environment before an invited tester can sign in.
- This decision is not approval for a public launch. Privacy disclosure, security review,
  Chrome E2E acceptance, and invited-alpha acceptance remain release gates.
