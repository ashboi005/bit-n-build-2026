# Running it — what's needed, and what isn't

Current status: **the server boots, auth works against the live DB, and the SSE
investigation streams end to end.** The only thing missing is a working Merge
Gateway key. Everything else is done.

---

## 1. Already done — you don't need to do these

- ✅ **Database migrated.** `bun run db:migrate` has been run against the live
  Postgres. The four auth tables (`user`, `session`, `account`, `verification`)
  exist. **You do not need to run `db:push` or `db:migrate`.** The migration SQL
  is committed at `packages/db/src/migrations/`.
- ✅ Sign-up / sign-in verified end to end against that live DB.
- ✅ `packages/contracts`, `packages/llm`, `packages/engine` built and type-checking.
- ✅ Server routes live and tested: SSE thesis stream, stocks, glossary, profile,
  Time Machine seed, health.
- ✅ Port is now configurable via `PORT` (Coolify injects it automatically).

---

## 2. The one thing that's actually blocking: the Merge key

Right now `/api/health` reports `llmConfigured: false`, and every LLM stage fails
with `/chat/completions failed: 405`.

A 405 is "wrong method for this path", which almost always means **the base URL is
wrong**, not the key. Merge's own docs show two different hosts:

| Candidate | Where it appears |
|---|---|
| `https://gateway.merge.dev/v1` | Gateway product page |
| `https://api-gateway.merge.dev/v1` | The curl example in their API docs |

### What I need from you

1. **`MERGE_API_KEY`** — from your Merge dashboard.
2. **Confirm `MERGE_BASE_URL`.** Fastest check, 10 seconds:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer YOUR_KEY" https://gateway.merge.dev/v1/models
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer YOUR_KEY" https://api-gateway.merge.dev/v1/models
```

   Whichever returns `200` is the right one. Put it in `apps/server/.env`.

3. **Pin real model ids.** Once the key works:

```bash
curl -s -H "Authorization: Bearer YOUR_KEY" \
  https://<the-working-host>/v1/models | head -c 2000
```

   The ids in `.env.example` are educated guesses. Replace them with whatever your
   key actually returns and put those in `MERGE_MODEL_SMART` / `_FAST` / `_EMBED`.
   An unknown model id fails at call time, not at startup — so this is worth
   getting right now rather than at hour 11.

---

## 3. Vector database — my honest answer: you probably don't need one

You asked about self-hosting Qdrant or Chroma. Before you spend time on it:

### The maths

Our dataset is **~20 stocks**. Realistically that's 300–600 text chunks. At 1536
dimensions that's about **4 MB of floats**. Brute-force cosine similarity over
600 vectors takes **under a millisecond** in plain TypeScript.

A vector database earns its keep somewhere north of 100k vectors. We are three
orders of magnitude below that. Self-hosting one here buys us:

- ❌ another container to deploy and keep alive during judging
- ❌ another failure mode at hour 11
- ❌ another env var that can be wrong
- ✅ nothing measurable

**Recommendation: skip it.** Embed the chunks once, cache the vectors to a JSON
file next to Tushar's snapshot, load into memory at boot, cosine in a loop. It is
faster than a network hop to Qdrant would be, and it cannot go down.

The code is already shaped for this — `SourcesPort.searchSources()` is the seam.
Today it's keyword matching; swapping in in-memory vectors changes one function
and nothing else.

### If you want one anyway — use Qdrant, not Chroma

Both work, but for this stack:

| | Qdrant | Chroma |
|---|---|---|
| Deploy | Single Rust binary / one small image | Python service |
| Calling from Bun | Plain `fetch` against a clean REST API | Client is Python-first; JS client lags |
| API stability | Stable | Has churned noticeably across versions |
| Coolify | Straightforward one-service deploy | More moving parts |

**Qdrant, clearly**, if you're self-hosting one.

#### Coolify steps for Qdrant

1. Coolify → **New Resource → Docker Image** → `qdrant/qdrant:latest`
2. Port: **6333** (HTTP). Expose it, or keep it internal and call it over the
   Coolify internal network from the server container.
3. Add a persistent volume mounted at `/qdrant/storage` — otherwise it's wiped on
   every redeploy.
4. Set an API key: env `QDRANT__SERVICE__API_KEY=<something-random>`.
   **Do this** — an open Qdrant on a public port is an open database.
5. Give me back:
   - `QDRANT_URL` — e.g. `http://qdrant:6333` internally, or the public URL
   - `QDRANT_API_KEY` — what you set above

Both are already declared as **optional** in `.env.schema` and `.env.example`.
Blank = in-memory, which is the default. If you fill them in, tell me and I'll
write the client — it's about 40 lines against their REST API.

### The third option, if you want persistence without a new service

The Postgres is already live and already has Drizzle wired up. **pgvector** needs
one statement:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

If that succeeds on your Postgres, that's zero new infrastructure. If it errors
(the extension isn't installed on the host), don't chase it — go in-memory.

---

## 4. Running locally

```bash
bun install
bun run dev:server     # http://localhost:3000
bun run dev:web        # http://localhost:3001
```

Ports are 3000 (server) and 3001 (web). If something else holds 3000, set
`PORT=3100` rather than killing it.

### Verify it's alive

```bash
curl -s localhost:3000/api/health
# {"ok":true,"stocks":1,"model":"...","llmConfigured":true}
```

`llmConfigured: false` means the Merge key is still the placeholder.

### Verify the whole flow

```bash
# sign up (writes a cookie jar)
curl -s -c /tmp/c.txt -X POST localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@test.local","password":"hackathon123","name":"You"}'

# Time Machine
curl -s -b /tmp/c.txt -X POST localhost:3000/api/demo/seed \
  -H 'Content-Type: application/json' -d '{"stage":"day15"}'

# the investigation stream
curl -sN -b /tmp/c.txt -X POST localhost:3000/api/thesis/stream \
  -H 'Content-Type: application/json' \
  -d '{"query":"Defence spending is up so I want to buy HAL"}'
```

---

## 5. Deploying to Coolify

Two services from this repo. Dockerfiles already exist at `apps/server/Dockerfile`
and `apps/web/Dockerfile`.

### Server

- Env: everything in `apps/server/.env.example`
- **Don't set `PORT`** — Coolify injects it and the server reads it
- `BETTER_AUTH_URL` = the server's own public URL
- `CORS_ORIGIN` = the web app's public URL

### Web

- Env: everything in `apps/web/.env.example`
- `NEXT_PUBLIC_SERVER_URL` = the server's public URL

### ⚠️ Two deployment gotchas that will cost you the demo

1. **Buffering kills SSE.** If a proxy buffers the response, the investigation
   arrives as one lump at the end instead of assembling live — which is the entire
   demo. The server already sends `X-Accel-Buffering: no`. If it still buffers on
   Coolify's Traefik, **run the demo against localhost instead.** Don't debug a
   proxy at hour 11.

2. **Cookies across domains.** Auth cookies are set `SameSite=None; Secure`, so
   both apps must be on **HTTPS** in production. Coolify gives you Let's Encrypt
   certs — just make sure both are actually on `https://`, and that
   `CORS_ORIGIN` and `BETTER_AUTH_URL` are the real public URLs with no trailing
   slash.

---

## 6. Summary — what I need from you

| # | Thing | Blocking? |
|---|---|---|
| 1 | `MERGE_API_KEY` | 🔴 **Yes** — LLM stages can't run without it |
| 2 | Confirmed `MERGE_BASE_URL` (the curl test above) | 🔴 **Yes** — currently 405 |
| 3 | Real model ids from `/v1/models` | 🟡 Soon — guesses will fail at call time |
| 4 | Qdrant URL + key | ⚪ **Only if you decide to** — I'd skip it |
| 5 | `db:push` / `db:migrate` | ✅ **Already done.** Don't run anything |
