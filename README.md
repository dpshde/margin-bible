# Margin on Workers + D1 (labs spike)

A cheap-hosting sketch of the chapter reader. Deployed Worker version is exposed at `GET /health` (`version`). Rails on Railway stays the product. This app does not migrate Postgres, does not delete Railway services, and does not change `margin.bible` DNS.

Open a chapter by OSIS slug, focus a verse, and keep notes in D1. Guest browsing still uses an anonymous `margin_library` cookie. Sign in with a passphrase to bind notes to a stable library that follows you across browsers.

## Run locally

From `spike/workers/`:

```sh
bun install
bun run build:bsb          # refresh assets/bsb from the official USJ zip; committed cache is enough to skip this
bun run migrate:local      # apply D1 migrations to the local Miniflare database
bun run dev                # http://localhost:8787
bun test
bun run check
```

`wrangler` is the dev server and the deploy tool. There is no Rails process and no Postgres.

### Smoke checklist

1. Open `/jhn.3.16`. The page is John 3, verse 16 is highlighted, and the pericope heading “Jesus and Nicodemus” is on verse 1. The verse text includes “For God so loved the world”.
2. Type into the note box. Within a moment the status says Saved. Reload. The note is still there.
3. `GET /api/notes?chapter=jhn.3` lists that note. `GET /api/notes?verse=jhn.3.16` lists notes that cover verse 16.
4. Open `/jhn.3.16-18` and save a second note. Both rows remain. The verse note is not merged into the range note, and neither is merged into the chapter note at `/jhn.3`.
5. Clear the textarea and wait. The note row is deleted.
6. Jump with `John 3:16` or `jhn.3.16`. The share link points at `https://route.bible/jhn.3.16`.
7. `/notes` lists the library. A new browser profile (no cookie) sees an empty library.

```sh
curl -s -c /tmp/margin.ck -b /tmp/margin.ck http://localhost:8787/jhn.3.16 | grep -o "For God so loved the world"
curl -s -c /tmp/margin.ck -b /tmp/margin.ck -X PUT http://localhost:8787/api/notes/jhn.3.16 \
  -H 'content-type: application/json' \
  -d '{"text":"loved the world"}'
curl -s -c /tmp/margin.ck -b /tmp/margin.ck http://localhost:8787/api/notes?chapter=jhn.3
```

## Preview on workers.dev

This checkout does not ship a live URL. Deploy when you have a Cloudflare account:

```sh
bunx wrangler login
bunx wrangler d1 create margin-spike
```

Put the printed `database_id` in `wrangler.jsonc` (replace the all-zero local placeholder). Then:

```sh
bunx wrangler d1 migrations apply margin-spike --remote
bunx wrangler deploy
```

Wrangler prints a `*.workers.dev` URL. That host is the spike. Leave `margin.bible` on Railway.

## What is in

| Piece | Spike behavior |
|---|---|
| Reader | `GET /jhn.3`, `/jhn.3.16`, `/jhn.3.16-18`. The page is always the chapter. A verse or range focuses those verses. |
| Addresses | npm [`grab-bcv`](https://www.npmjs.com/package/grab-bcv) `findAnyPassage` on `/jump` + route slugs (same OSIS contract as Rails / route.bible). Jump bar autosuggest (`/api/jump-suggest`, Rails `jump-suggest` / `search_controller` parity). `John 3:16`, `Jn 3`, `jhn.3.16`. This is not Bible search. |
| Scripture | Official BSB USJ, flattened with the same verse-row rules as `Margin::Usj.pack_chapter`. One JSON file per chapter in `assets/bsb/`. Public domain. |
| Notes | One row per library + slug. Verse, range, and chapter notes stay separate. Body is outline blocks, same idea as Rails. |
| Bookmarks | Tray bookmark control on every expanded outliner (verse + chapter). Empty bookmarked notes are kept. |
| Attachments | `xref` + `url` chips on the note (`att-board`). Paperclip opens attach dialog. Scanned from `[[wiki]]` / natural refs in block text; manual chips stay. |
| Cross-refs | Inline wiki links in the outliner + attached xref chips. Same-chapter chip/link click peeks verses (`?xref=1` / `is-xref`). Jump bar still uses grab-bcv. |
| Session | HttpOnly `margin_library` cookie. Passphrase sign-in (`/login`) binds a stable `identity_key` library and sets `margin_auth`. |
| Share-out | `https://route.bible/{slug}` only. Chapter HTML is not loaded from route.bible. |
| API | `GET /api/notes`, `GET /api/notes?chapter=jhn.3`, `GET /api/notes?verse=jhn.3.16`, `PUT /api/notes/:slug` with `{ "text" }` or `{ "blocks" }` plus optional `bookmarked` and `attachments`. No path version. |

`POST /api/search` is not implemented. Search stays with the sibling that owns it.

## Auth (passphrase, then passkey)

Open **Sign in** (top-right) or `/login`.

1. Enter a passphrase of at least 12 characters. Optional label is only a reminder.
2. Submit **Open library**. The browser gets an `HttpOnly` `margin_session` cookie. The value is a random session id in D1, not the library id. The passphrase is stored as an HMAC lookup (Worker secret `AUTH_PEPPER`) plus PBKDF2 with a per-library salt.
3. The same passphrase on another browser opens the same notes. A guest library that already has notes is bound in place. An empty miss asks you to confirm before a typo creates a new library. There is no email reset.
4. **Sign out** deletes that session and mints a fresh guest library.
5. **Change passphrase** asks for the current phrase and the new phrase twice. A wrong current phrase counts toward the rate limit. Other sessions for that library are signed out. Passkeys already enrolled on a device keep working.
6. Passkeys are on for the site you are visiting, including `https://margin-bible.dpshade.workers.dev`. The relying party id is that host unless `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` pin a different matching origin. A passkey made on `workers.dev` does not sign in on `margin.bible`. Add one from the profile page after a passphrase sign-in, and remove one from that list. Removing a passkey does not sign out browsers that already have a session. Either factor mints a session.

`/login` rate-limits failed attempts (8 per IP per 15 minutes). A one-time recovery code, if one was issued for a library, binds your passphrase onto that library.

## Bookmarks, attachments, cross-refs

Every expanded verse/chapter tray has the Rails tray controls that matter for this spike:

1. **Bookmark** — toggle on the tray head. A bookmarked note with blank body is kept (not deleted).
2. **Attach** — paperclip opens a dialog for a passage (`John 3:16` / `jhn.3.16`) or an `http(s)` URL. Chips render on `att-board`. Typing `[[rom.8.28]]` or a natural ref in the outliner also scans into xref chips (manual chips are kept when the text changes).
3. **Inline + attached xrefs** — outliner text decorates wiki/natural refs as `a.wiki`. Same-chapter wiki or xref-chip clicks peek the verses (`is-xref`, `?xref=1`) without leaving the chapter; other chapters navigate normally.

## Mobile + two-space indent

- Viewport uses `viewport-fit=cover` and `interactive-widget=resizes-content`. Sticky topbar and tray chrome respect safe-area insets; tray actions are ≥44px (`--tap`). Soft-keyboard focus keeps the tray status/actions visible (tray-head footer under the outliner + `visualViewport` scroll). Opening a verse near the bottom waits for the ~100ms tray open anim, then `snappyScrollIntoView` (`block: nearest`) with bottom inset `1.25rem + safe-area` so the tray-head is not hard-cut.
- Outliner: **two spaces** (or Tab) indents — Rails `shouldIndentOnSpace` / `consumeLeadingSpace` parity. Enter = next node; Shift+Enter = newline. Hover-only chrome is gated behind `(hover: hover)`.

## Closing verse trays

Tap an open verse again to collapse its tray (Rails-like toggle). Verse note trays open and close with a quick ~100ms `grid-template-rows` / opacity expand (instant under `prefers-reduced-motion`). Close waits for `transitionend` before `hidden` so height→0 and display:none do not race layout (no end-of-close jitter). Empty trays no longer trap the UI.

## Header chrome + chapter note rail

Top-bar actions (icon-only + tooltips):

1. **Profile / sign-in** — auth chip.
2. **Bookmark chapter** — Phosphor `bookmark-simple`. Toggles `bookmarked` on the chapter slug (same flag as the chapter tray’s bookmark control). Empty bookmarked chapter notes are kept.
3. **Expand notes** — Phosphor `arrows-out` / `corners-in`. Expands/collapses verse note trays only; chapter notes stay independent.

**Chapter note** is no longer a topbar pencil. A nearly invisible peek row sits above the chapter text (`#chapter-note-peek`); tap it to expand `#chapter-tray`, × (or toggle) collapses back to the peek. `?chapter_note=1` still opens it. The first-visit outliner hint (`#reader-hint`) hides after tap/interact and stays hidden via `localStorage`.

**Expand notes** (top bar) opens every verse tray that already has text, then snappy-scrolls to the first opened tray so you are not left at the top of the chapter. The header icon is Phosphor arrows-out when collapsed and corners-in when expanded (quick ~180ms crossfade), matching other icon-only topbar buttons (no bordered pill). It toggles to **Collapse notes**, shows a pressed state while expanded, and disables when the chapter has no verse notes. While expanded, tapping a verse again collapses that verse’s trays without fighting the selection.

## Notes inbox grouping

`/notes` lists notes newest-first:

1. **Last 14 days** — week-separated individual note rows (`This week` / `Last week` / dated week headers).
2. **Older** — one row per chapter (verse/range notes in that chapter collapse into a single chapter link), ordered by most recent activity in the chapter.


## MCP (Lamp / agents)

Read-only Streamable HTTP MCP at `POST/GET/DELETE/OPTIONS /mcp` (JSON, handshake `2025-11-25`). Auth is `Authorization: Bearer` via Worker secrets `MCP_BEARER_TOKEN` + `MCP_LIBRARY_ID`. Cookie sessions for the human UI are unchanged. Tools: `list_notes`, `get_note`, `list_notes_covering_verse`, `export_library`, `personal_study`, `prepare_group_study`. Point Lamp's `user-margin-bible` at `https://margin-bible.dpshade.workers.dev/mcp`.

## What is out

Compared with the Rails app:

- Magic-link email delivery, full OAuth/DCR for MCP, Cloudflare Access.
- Hotwire Native / the iOS shell
- Agent signatures, read trail UI, inbox, file (CAS) attachments — spike chips are xref + http(s) URL only
- Copy-note / tray-external chrome beyond the route.bible label link
- `margin.bible` DNS. The live Worker is still `https://margin-bible.dpshade.workers.dev`.

## Cost thesis

Railway keeps a Rails process resident (the idle footprint called out for this app was about half a gigabyte) plus a Postgres service that bills while nobody is reading. The spike moves the same loop onto hosts that scale to zero:

- [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day and does not bill duration. There is no idle VM. Requests to static assets are free and unlimited; chapter JSON is an asset. Paid Workers starts at $5/month and then $0.30 per extra million requests, still without reserved RAM.
- [D1](https://developers.cloudflare.com/d1/platform/pricing/) bills rows read, rows written, and storage above the included amount. It does not bill compute hours. Free includes 5 million rows read/day, 100,000 rows written/day, and 5 GB. A personal notebook sits inside that. If you are not querying, you are not billed for database compute.

Idle cost of this shape is $0 on the free plan. The $5 Workers Paid floor only matters after you outgrow the free request or D1 daily limits. That is the opposite of an always-on Rails dyno plus Postgres.

Scripture stays in the asset cache, not in D1, so chapter reads do not become database rows.

## Contracts

Public paths are opaque and unversioned: `/jhn.3.16`, `/api/notes/jhn.3.16`, `/notes`. Slugs match grab-bcv and route.bible. A blank note deletes the row for that slug only.
