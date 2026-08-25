# AGENTS.md — Margin

Product: **margin.bible**. Rails 8.1 hosted Bible reader + notes. The product is the chapter page.

## Product model (do not invert)

| Priority | Meaning |
|---|---|
| **Full-Bible reading** | The page is always a chapter, with BSB pericope headings. |
| **Notes in the stream** | Tap a verse → outline tray. Address = OSIS slug. Compose, don’t absorb. |
| **Hosted** | Anonymous library cookie, then magic-link claim. No self-host door as the product. |

Mobile is a **thin Hotwire Native shell** (`ios/`) that loads this Rails site. Native navigation is the chrome on device; the web topbar is hidden when `hotwire_native_app?` (Turbo/Hotwire Native user agent). Do not build Expo. Do not reimplement a second reader.

`legacy/` is the previous Elixir/pack/Expo demo. Do not restore multiword doors, pack-on-disk as source of truth, or “no accounts” as a principle.

## Plumbing (invisible)

- **grab-bcv** — browser autocomplete + `tryParseAnyPassage`. Server stores canonical slugs (`lib/margin/passage.rb` + `vendor/data/books.json`).
- **route.bible** — outbound links only (`Margin::RouteBible.url_for`). Do not load chapter HTML from route.bible.

## Commands

```sh
bin/setup
bin/dev
bin/rails test
npm run build
bin/rails margin:seed_scripture
```

Preview: Vercel builds `Dockerfile.vercel` via `vercel.json` (set `SECRET_KEY_BASE`).

## Touchpoints

| Concern | Where |
|---|---|
| Chapter reader | `app/controllers/reader_controller.rb`, `app/views/reader/` |
| Note autosave | `app/controllers/notes_controller.rb`, `reader_controller.js` |
| Jump box | `search_controller.js` (grab-bcv) |
| OSIS | `lib/margin/passage.rb` |
| BSB + headings | `vendor/scripture/bsb`, `Verse` |
| Library cookie | `ApplicationController#set_current_library` |
| Hotwire Native path config | `public/configurations/ios_v1.json` (bundled copy in `ios/Margin/`) |
| iOS shell | `ios/Margin.xcodeproj` — SPM `hotwire-native-ios`, localhost debug / margin.bible (or `MARGIN_BASE_URL`) release |

## Must not

- Replace the reader with the route.bible launcher.
- Reimplement grab-bcv in Ruby beyond slug/human parse already in `Passage`.
- Merge verse notes into the chapter note.
- Treat `legacy/` as the deploy target.
- Build Expo, or a native Bible app that is not a Hotwire Native shell of this chapter page.
