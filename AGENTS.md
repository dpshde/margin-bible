# AGENTS.md — Margin

Product: **margin.bible**. Rails 8.1 hosted Bible reader + notes. The product is the chapter page.

## Product model (do not invert)

| Priority | Meaning |
|---|---|
| **Full-Bible reading** | The page is always a chapter, with BSB pericope headings. |
| **Notes in the stream** | Tap a verse → outline tray. Address = OSIS slug. Compose, don’t absorb: a verse note and a range note that covers it stay two records. |
| **Hosted** | Anonymous library cookie, then magic-link claim. No self-host door as the product. |

Mobile follows the HEY/Basecamp model: a **thin Hotwire Native shell** (`ios/`) with a native navigation stack, transitions, and gestures. The WebView renders this same Turbo/Rails chapter page. Hide the web topbar when `hotwire_native_app?`. Bridge Components only if the native bar needs the header menu / share sheet. No Expo. No commercial Ruby Native layer. No fully native reader screens.

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
| BSB + headings | `vendor/scripture/bsb` (Arweave JSONL → chapter pack), `Verse` |
| Library cookie | `ApplicationController#set_current_library` |
| Hotwire Native path config | `public/configurations/ios_v1.json` (bundled copy in `ios/Margin/`) |
| iOS shell | `ios/Margin.xcodeproj` — SPM `hotwire-native-ios`, localhost debug / margin.bible (or `MARGIN_BASE_URL`) release |

## Must not

- Replace the reader with the route.bible launcher.
- Reimplement grab-bcv in Ruby beyond slug/human parse already in `Passage`.
- Merge verse notes into the chapter note.
- Treat `legacy/` as the deploy target.
- Build Expo, a commercial Ruby Native layer, or a native Bible/reader screen that is not a Hotwire Native WebView of this chapter page.
- Merge a verse note into a range or into the chapter note.
