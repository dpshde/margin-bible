# Rails → prod D1 migration report

Date: 2026-09-29 (America/New_York)

## Outcome
Imported Dylan's authorized Rails library notes into Cloudflare **prod** D1 `margin-bible` (`0f48d232-f2d8-46c2-a8a3-3b36c4279feb`). Spike D1 and Railway left running. No DNS/custom-domain cutover. Railway not deleted.

## Source
- Prefer DATABASE_URL dump: **not available to this agent**. Railway MCP `list-variables` returns names only (no secret values). Railway CLI is installed but **Unauthorized** (no `railway login`). Postgres has **no TCP proxy** / no `DATABASE_PUBLIC_URL` (private networking only).
- Used read-only **user-margin-bible** MCP `export_library` (authorized Dylan library) → `margin.library-snapshot` v1 with full blocks + attachments.
- Side effect: Railway agent briefly created function `inventory-query` to run read-only SQL; a **staged delete** of that function is waiting for dashboard 2FA. Do not treat that as part of the product cutover.

## Auth mapping
Rails libraries use `claim_token` / passkeys / magic links — **no passphrase hash**. Prod Workers hash is `SHA-256(PEPPER + ":" + NFKC passphrase)` with `PEPPER=margin-spike-v1` stored as `libraries.identity_key`.

**Chose (B):** import library with `identity_key = NULL`, label `Dylan (Rails)`. Existing Rails passphrase/passkey cannot open this row. Dylan must visit `/login` on prod and open (or create) a passphrase-bound library, then notes can be moved/claimed later — **or** set `identity_key` once his chosen prod passphrase hash is known.

Spike had only smoke-test bound libraries (`Smoke test` / unlabeled, 1 note each); those identity keys were **not** copied onto Dylan's 63-note library.

## Destination mapping
| Rails | D1 |
|---|---|
| libraries.id (int 96) | libraries.id UUID `6d617267-696e-4096-a000-000000000096` |
| last_read_slug / notes.* | same columns |
| blocks JSON | notes.blocks TEXT JSON |
| bookmarked bool | notes.bookmarked 0/1 |
| attachments JSON | notes.attachments TEXT JSON |
| claim_token, user_id, passkeys, oauth, magic_links, verses, agent_* | **not migrated** (no D1 columns / not needed for reader) |

## Counts
| | Source (Rails export) | Dest (prod D1 via Worker API) |
|---|---|---|
| Notes | 63 | 63 |
| Libraries imported | 1 (Dylan authorized) | 1 labeled `Dylan (Rails)` (+ 2 pre-existing empty guest libs left alone) |
| Bookmarked | 0 | 0 |
| With attachments | 9 | 9 |
| Kinds | verse 56 / range 4 / chapter 3 | same |
| Books | DEU 11, HEB 19, ISA 1, LUK 21, PSA 2, ROM 9 | same |

Slug set matches exactly (0 missing / 0 extra). Sample block/attachment equality checked for `heb.12.15`, `luk.16`, `deu.22.28-29`.

## Left behind on Railway
- Other guest/empty libraries (inventory-query log showed many library ids; notes concentrated on library 96).
- users, passkeys, magic_links, oauth_*, verses (BSB text already in Worker assets).
- claim_token / email auth.

## Commands used
```sh
# export (MCP): user-margin-bible export_library → scripts/rails-library-96.snapshot.json
# build SQL: scripts/import-rails-library-96.sql (64 statements, no BEGIN/COMMIT)
CLOUDFLARE_API_TOKEN=<(oauth from ~/.config/cloudflare/config/default.json) \
CLOUDFLARE_ACCOUNT_ID=91ff2c2b757414041aeaa00896a8a43f \
  bunx wrangler d1 execute margin-bible --remote --file scripts/import-rails-library-96.sql
# from cwd /workspace/margin-spike-deploy/prod/workers
```

Import result: `Processed 64 queries` / `191 rows written` on database `0f48d232-...`.

## Smoke
- `GET https://margin-bible.dpshade.workers.dev/health` → `{"ok":true,"app":"margin-bible"}`
- `GET /login` → 200 passphrase UI
- Cookie `margin_library=6d617267-696e-4096-a000-000000000096`:
  - `/api/notes` → 63 notes
  - `/api/notes?verse=heb.12.15` → `heb.12.15`
  - `/api/notes?chapter=luk.15` → 15 notes
  - `/heb.12.15` HTML contains outliner text "What is bitterness?"
- Spike `https://margin-bible-spike.dpshade.workers.dev/health` still ok; same library UUID returns 0 notes there (prod-only import).
- Rails `https://margin-bible.up.railway.app/up` → 200. DNS untouched.

## Follow-ups for Dylan
1. Choose a prod passphrase on `/login`, note the new `identity_key` library id, then either re-import notes under that id or UPDATE `libraries.identity_key` for `6d617267-...` to the hash of that passphrase (option A retrofit).
2. Apply the staged Railway delete of leftover `inventory-query` in the dashboard (2FA), or leave it — it is not the Rails app.
3. Cloudflare OAuth token expired after import (~19:37Z); refresh with interactive `wrangler login` before further D1 CLI work.
