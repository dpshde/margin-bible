# Margin on Workers + D1 (labs spike)

A cheap-hosting sketch of the chapter API. Rails on Railway stays the product. This app does not migrate Postgres, does not delete Railway services, and does not change `margin.bible` DNS.

Open a chapter by OSIS slug, focus a verse, and keep notes in D1. An anonymous `margin_library` cookie is the library. Claiming it with a magic link is out of scope.

The client for this spike is a thin SwiftUI app in [`spike/ios/`](../ios/). It calls the JSON API below. The HTML page at `GET /<slug>` is a debug reader so the API can be checked without Xcode. Hotwire Native is a dead path: do not extend the Rails `ios/` shell for this spike, and do not delete it either.

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

Local dev uses wrangler: it is the dev server, and `migrate:local` targets the Miniflare D1 that `wrangler dev` reads. There is no Rails process and no Postgres. Remote account setup is below, and it uses `cf`.

### Smoke checklist

1. `GET /api/chapters/jhn.3.16` returns John 3, focused on verse 16. Verse 1 has the heading “Jesus and Nicodemus”. Verse 16 includes “For God so loved the world”. `routeBibleUrl` is `https://route.bible/jhn.3.16`.
2. `GET /api/chapters?q=John+3:16` resolves the same chapter document.
3. `PUT /api/notes/jhn.3.16` with `{ "text": "loved the world" }`, then `GET /api/chapters/jhn.3.16` again. The note is on that slug. `GET /api/notes?verse=jhn.3.16` lists notes that cover verse 16.
4. `PUT /api/notes/jhn.3.16-18` with a second body. Both rows remain. The verse note stays its own record, and neither is merged into the chapter note at `jhn.3`.
5. `PUT` the verse slug again with blank text. That row is deleted. The range note remains.
6. The debug page at `/jhn.3.16` shows the same chapter, highlight, and share link. It is not the client.
7. `/notes` lists the library. A new cookie sees an empty library.

```sh
curl -s -c /tmp/margin.ck -b /tmp/margin.ck http://localhost:8787/api/chapters/jhn.3.16
curl -s -c /tmp/margin.ck -b /tmp/margin.ck "http://localhost:8787/api/chapters?q=John%203:16"
curl -s -c /tmp/margin.ck -b /tmp/margin.ck -X PUT http://localhost:8787/api/notes/jhn.3.16 \
  -H 'content-type: application/json' \
  -d '{"text":"loved the world"}'
curl -s -c /tmp/margin.ck -b /tmp/margin.ck http://localhost:8787/api/notes?chapter=jhn.3
```

## Preview on workers.dev

Run this on the machine where `cf auth login` has already succeeded. This cloud checkout is not that login: `cf auth whoami` here still says not logged in, and there is no API token to copy. Do not paste a token into the repo.

That machine uses Node 22 from mise. If `node -v` prints 20, activate mise before `cf` or wrangler:

```sh
eval "$(mise activate bash)"
# or, if mise is not on PATH:
export PATH="$HOME/.local/share/mise/installs/node/22/bin:$PATH"
node -v
cf auth whoami
```

`cf` creates the D1 database and applies migrations. Wrangler deploys this `wrangler.jsonc` project, which is what attaches the `DB` binding. From `spike/workers/`:

```sh
cf d1 create --name margin-spike
```

Put the printed database id in `wrangler.jsonc` (replace the all-zero local placeholder). `cf d1` remote commands take that id, not the database name.

```sh
cf d1 migrations apply <database-id> --dir migrations
bunx wrangler deploy
```

Wrangler prints a `*.workers.dev` URL. That host is the spike. Leave `margin.bible` on Railway. The local `bun run migrate:local` script stays on wrangler so it hits the same Miniflare database as `bun run dev`.

## What is in

| Piece | Spike behavior |
|---|---|
| Chapter API | `GET /api/chapters/<slug>` and `GET /api/chapters?q=<human or slug>`. The document is the chapter. `passage` is the focused address. |
| Addresses | Same grab-bcv slugs as Rails (`vendor/data/books.json`). `John 3:16` parses. This is not Bible search. |
| Scripture | Official BSB USJ, flattened with the same verse-row rules as `Margin::Usj.pack_chapter`. One JSON file per chapter in `assets/bsb/`. Public domain. |
| Notes | One row per library + slug. Verse, range, and chapter notes stay separate. Body is outline blocks, same idea as Rails. |
| Session | HttpOnly `margin_library` cookie. Possession of the cookie is the library. |
| Share-out | `https://route.bible/{slug}` only. Chapter HTML is not loaded from route.bible. |
| Notes API | `GET /api/notes`, `GET /api/notes?chapter=jhn.3`, `GET /api/notes?verse=jhn.3.16`, `PUT /api/notes/<slug>` with `{ "text" }` or `{ "blocks" }`. No path version. |
| Debug page | `GET /<slug>` renders the same chapter in HTML so you can check the pack without the iOS app. |
| SwiftUI | [`spike/ios/`](../ios/) calls the chapter and notes APIs. Share-out uses `routeBibleUrl`. |

`POST /api/search` is not implemented. Search stays with the sibling that owns it.

## What is out

Compared with the Rails app:

- Magic-link claim, passkeys, OAuth, and MCP
- Hotwire Native and any hybrid web shell. That path is dead for the spike. The Rails `ios/` project stays untouched.
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

Public paths are opaque and unversioned: `/api/chapters/jhn.3.16`, `/api/notes/jhn.3.16`, `/notes`. Slugs match grab-bcv and route.bible. A blank note deletes the row for that slug only.

`GET /api/chapters/<slug>` and `GET /api/chapters?q=<query>` return:

```json
{
  "ok": true,
  "passage": { "slug": "jhn.3.16", "osis": "JHN.3.16", "label": "John 3:16", "kind": "verse", "book": "JHN", "chapter": 3, "verseStart": 16, "verseEnd": null },
  "chapter": { "slug": "jhn.3", "label": "John 3", "translation": "BSB", "book": "JHN", "chapter": 3, "verses": [{ "v": 1, "text": "…", "heading": "Jesus and Nicodemus" }] },
  "routeBibleUrl": "https://route.bible/jhn.3.16",
  "prev": "jhn.2",
  "next": "jhn.4",
  "notes": []
}
```

`notes` on that document are the chapter’s rows, including a verse note and a range note that covers it, as separate records. An unknown address is `422` `{ "ok": false, "error": "unresolvable" }`. A parsed chapter with no pack file is `404` `{ "ok": false, "error": "missing chapter" }`.

## SwiftUI client

`spike/ios/MarginSpike.xcodeproj` is an iOS 17 reader meant to match the Rails chapter page: paper, Source Serif 4 / Poppins / Lexend, verse gutter, section headings, the bottom jump bar, and the dock (focus, chapter note, expand notes, hide verse numbers).

The outliner is one row per block, with the Rails indent step (`1.15rem`), bullet dot, and tray label. Return or the keyboard “New line” splits a block. A leading space indents. Verse notes and range notes stay separate trays. Expand notes opens every tray that already has text; tap a verse to open or collapse that verse. Long-press a verse, then tap another, to focus a range. Share-out is still `https://route.bible/{slug}`.

The app talks to the Workers API that is already deployed. It tries `GET /api/chapters/<slug>` and, when that route is absent, loads `GET /bsb/<book>.<chapter>.json` plus `GET /api/notes?chapter=<slug>`. Saves are `PUT /api/notes/<slug>` with `{ "blocks" }`. Do not redeploy the Worker for this client. The Rails `ios/` Hotwire project is not part of this spike.

This checkout has no Xcode, so the project has not been compiled here. On a Mac, open `spike/ios/MarginSpike.xcodeproj`. The Workers URL in the dock defaults to `https://margin-bible-spike.dpshade.workers.dev`.
