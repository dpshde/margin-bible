# Margin

**[margin.bible](https://margin.bible)** — a hosted Bible reader and notebook. Open a chapter, read under the translation’s section headings, tap a verse, type. Notes persist on a library you can claim with a magic link.

**Priorities:** read the whole Bible → take notes in the stream → keep them.

## What you get

| Surface | Behavior |
|---|---|
| Chapter reader | BSB text with pericope headings (same as the old mobile `/read` screen) |
| Notes | Per OSIS address (`jhn.3.16`, `jhn.3.16-18`, `jhn.3`). Autosave. |
| Jump | `grab-bcv` autocomplete in the browser; Rails stores canonical slugs |
| Share out | `https://route.bible/{slug}` — not the in-app reader |
| Sign in | Magic link. First note does not require an account. |

The pack-on-disk / Elixir door / Expo app live in [`legacy/`](legacy/) as the previous protocol demo.

## Quick start

```sh
bin/setup          # bundle, yarn/npm, db:prepare, seed BSB
bin/dev            # http://localhost:3000
```

Or:

```sh
bundle install
npm install
bin/rails db:prepare
bin/rails db:seed   # ~31k BSB verses with headings
npm run build
bin/rails server
```

Open `/jhn.1`. Search “John 3:16”. Tap a verse.

Preview on Vercel via `Dockerfile.vercel` (set `SECRET_KEY_BASE`).

## Layout

```text
app/                  Rails 8.1 product
lib/margin/         Passage, Books (from grab-bcv tables), RouteBible
vendor/scripture/bsb  BSB chapter JSON (headings included)
vendor/data/books.json grab-bcv book/alias/count tables
legacy/               Elixir door, Expo client, PROTOCOL.md
```

## Address contract

Same slugs as grab-bcv and route.bible: `jhn.3`, `jhn.3.16`, `jhn.3.16-18`. The reader always renders the **chapter**; a verse URL focuses that verse.

## License / status

Product rewrite on Rails 8.1. Scripture: Berean Standard Bible (see `vendor/scripture/bsb/NOTICE`).
