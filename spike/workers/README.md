# Margin on Workers + D1 (labs spike)

A cheap-hosting sketch of the chapter reader. Rails on Railway stays the product. This app does not migrate Postgres, does not delete Railway services, and does not change `margin.bible` DNS.

Open a chapter by OSIS slug, focus a verse, and keep notes in D1. An anonymous `margin_library` cookie is the library. Claiming it with a magic link is out of scope.

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
| Addresses | Same grab-bcv slugs as Rails (`vendor/data/books.json`). `John 3:16` parses. This is not Bible search. |
| Scripture | Official BSB USJ, flattened with the same verse-row rules as `Margin::Usj.pack_chapter`. One JSON file per chapter in `assets/bsb/`. Public domain. |
| Notes | One row per library + slug. Verse, range, and chapter notes stay separate. Body is outline blocks, same idea as Rails. |
| Session | HttpOnly `margin_library` cookie. Possession of the cookie is the library. |
| Share-out | `https://route.bible/{slug}` only. Chapter HTML is not loaded from route.bible. |
| API | `GET /api/notes`, `GET /api/notes?chapter=jhn.3`, `GET /api/notes?verse=jhn.3.16`, `PUT /api/notes/:slug` with `{ "text" }` or `{ "blocks" }`. No path version. |

`POST /api/search` is not implemented. Search stays with the sibling that owns it.

## What is out

Compared with the Rails app:

- Magic-link claim, passkeys, OAuth, and MCP
- Hotwire Native / the iOS shell
- Attachments, bookmarks, agent signatures, read trail UI, inbox
- Autosave of a full outliner (the spike saves a textarea as blocks)
- Production data. D1 starts empty. Do not point this at Railway Postgres.
- DNS and the Railway services. They stay where they are.

## Cost thesis

Railway keeps a Rails process resident (the idle footprint called out for this app was about half a gigabyte) plus a Postgres service that bills while nobody is reading. The spike moves the same loop onto hosts that scale to zero:

- [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day and does not bill duration. There is no idle VM. Requests to static assets are free and unlimited; chapter JSON is an asset. Paid Workers starts at $5/month and then $0.30 per extra million requests, still without reserved RAM.
- [D1](https://developers.cloudflare.com/d1/platform/pricing/) bills rows read, rows written, and storage above the included amount. It does not bill compute hours. Free includes 5 million rows read/day, 100,000 rows written/day, and 5 GB. A personal notebook sits inside that. If you are not querying, you are not billed for database compute.

Idle cost of this shape is $0 on the free plan. The $5 Workers Paid floor only matters after you outgrow the free request or D1 daily limits. That is the opposite of an always-on Rails dyno plus Postgres.

Scripture stays in the asset cache, not in D1, so chapter reads do not become database rows.

## Contracts

Public paths are opaque and unversioned: `/jhn.3.16`, `/api/notes/jhn.3.16`, `/notes`. Slugs match grab-bcv and route.bible. A blank note deletes the row for that slug only.
