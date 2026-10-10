#!/bin/sh
# Publish this checkout as a separate Worker from a box that has run
# `cf auth login`. Does not deploy `margin-bible`. Does not use a Cloudflare
# API token; `cf` uses its OAuth login. GitHub Actions does not run this script.
# The preview Worker binds D1 `margin-bible-preview`, never the production
# database. PREVIEW_SEED is set only together with that preview id. A cookieless
# GET must not mint a guest library or seed notes.
set -eu
unset CLOUDFLARE_API_TOKEN

preview_name="margin-bible-verse-groups"
preview_url="https://${preview_name}.dpshade.workers.dev"
preview_version="2026.10.09.59"
preview_d1_id="e2d569dc-99f1-432c-899e-a1f9bf174cbf"
prod_d1_id="0f48d232-f2d8-46c2-a8a3-3b36c4279feb"
cfg="cloudflare.config.ts"
bak="${cfg}.preview-bak"

cp "$cfg" "$bak"
restore() {
  if [ -f "$bak" ]; then
    mv "$bak" "$cfg"
  fi
}
trap restore EXIT

python3 - "$cfg" "$preview_name" <<'PY'
import pathlib, sys
path, preview = sys.argv[1], sys.argv[2]
PROD_D1_ID = "0f48d232-f2d8-46c2-a8a3-3b36c4279feb"
PREVIEW_D1_ID = "e2d569dc-99f1-432c-899e-a1f9bf174cbf"
PREVIEW_D1_NAME = "margin-bible-preview"
file = pathlib.Path(path)
text = file.read_text()
worker_anchor = 'name: "margin-bible"'
if worker_anchor not in text:
    raise SystemExit("worker name anchor missing")
text = text.replace(worker_anchor, f'name: "{preview}"', 1)
if PROD_D1_ID not in text:
    raise SystemExit("prod D1 id anchor missing")
text = text.replace(PROD_D1_ID, PREVIEW_D1_ID, 1)
if text.count(worker_anchor) != 1:
    raise SystemExit("expected one remaining D1 name anchor")
text = text.replace(worker_anchor, f'name: "{PREVIEW_D1_NAME}"', 1)
seed_anchor = "ASSETS: bindings.assets(),"
seed_line = (
    "ASSETS: bindings.assets(),\n"
    f'\t\t\tD1_DATABASE_ID: bindings.text("{PREVIEW_D1_ID}"),\n'
    '\t\t\tPREVIEW_SEED: bindings.text("1"),'
)
if seed_anchor not in text:
    raise SystemExit("assets binding anchor missing")
text = text.replace(seed_anchor, seed_line, 1)
# Preview must not share production rate-limit namespaces. The same namespace
# id is one counter across every Worker on the account.
namespace_map = {
    "91011": "91021",
    "91012": "91022",
    "91013": "91023",
    "91014": "91024",
    "91015": "91025",
}
for src, dst in namespace_map.items():
    needle = f'namespace: "{src}"'
    if needle not in text:
        raise SystemExit(f"rate limit namespace {src} missing")
    text = text.replace(needle, f'namespace: "{dst}"', 1)
for src in namespace_map:
    if f'namespace: "{src}"' in text:
        raise SystemExit(f"prod rate limit namespace {src} still in preview config")
for dst in namespace_map.values():
    if f'namespace: "{dst}"' not in text:
        raise SystemExit(f"preview rate limit namespace {dst} missing")
if PROD_D1_ID in text:
    raise SystemExit("preview config still references prod D1")
if text.count(PREVIEW_D1_ID) < 2:
    raise SystemExit("preview D1 id missing from the binding and D1_DATABASE_ID")
if f'name: "{preview}"' not in text:
    raise SystemExit("preview worker name missing")
if f'name: "{PREVIEW_D1_NAME}"' not in text:
    raise SystemExit("preview D1 name missing")
if 'PREVIEW_SEED: bindings.text("1")' not in text:
    raise SystemExit("preview seed binding missing")
if worker_anchor in text:
    raise SystemExit("production worker or database name still in preview config")
file.write_text(text)
PY

if grep -q "$prod_d1_id" "$cfg"; then
  echo "refusing to migrate: preview config still has the prod D1 id" >&2
  exit 1
fi
if ! grep -q "$preview_d1_id" "$cfg"; then
  echo "refusing to migrate: preview D1 id missing" >&2
  exit 1
fi
eval "$(sh scripts/cloudflare-env.sh)"
if [ "$D1_ID" != "$preview_d1_id" ]; then
  echo "refusing to migrate: D1_ID is not the preview database" >&2
  exit 1
fi
mise exec -- cf d1 migrations apply "$D1_ID" --dir migrations

mise exec -- cf deploy

prod=$(curl -fsS -H "cache-control: no-cache" "https://margin-bible.dpshade.workers.dev/health" || true)
printf '%s\n' "$prod"
if printf '%s' "$prod" | grep -q "$preview_version"; then
  echo "production worker is serving this preview build" >&2
  exit 1
fi

i=0
body=""
while [ "$i" -lt 12 ]; do
  body=$(curl -fsS -H "cache-control: no-cache" "$preview_url/health" || true)
  printf '%s\n' "$body"
  if printf '%s' "$body" | grep -q "$preview_version"; then
    break
  fi
  i=$((i + 1))
  sleep 3
done
printf '%s' "$body" | grep -q "$preview_version"

notes_headers=$(mktemp)
notes=$(curl -fsS -D "$notes_headers" -A "Mozilla/5.0" -H "cache-control: no-cache" "$preview_url/notes")
if grep -qi '^set-cookie:.*margin_session=' "$notes_headers"; then
  echo "cookieless preview GET minted a session" >&2
  rm -f "$notes_headers"
  exit 1
fi
rm -f "$notes_headers"
printf '%s' "$notes" | grep -q 'id="verse-groups-view"'
printf '%s' "$notes" | grep -q 'id="bookmarks-view"'
printf '%s' "$notes" | grep -q 'class="bookmarks-view"'
printf '%s' "$notes" | grep -q 'No topics yet. Link 2+ notes to a hub'
if printf '%s' "$notes" | grep -q 'data-hub="rom.8.28"'; then
  echo "cookieless preview GET seeded a verse group" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'verse-groups-btn'; then
  echo "verse groups still uses the side button" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'Save sample'; then
  echo "sample save is still in the preview" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'local topic guess'; then
  echo "topic guess copy is still in the preview" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'verse-group-save'; then
  echo "verse group Save button is still in the preview" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q '.note-list li { border-top:'; then
  echo "note list border is still in the preview" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'data-hub="rom.9.17"'; then
  echo "empty library is still showing the sample web" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'data-vg-topic'; then
  echo "sparkle title button is still in the preview" >&2
  exit 1
fi
printf '%s' "$notes" | grep -q 'verse-group-members'
printf '%s' "$notes" | grep -q 'autoTitlePass'
printf '%s' "$notes" | grep -q '>Topics</span>'
printf '%s' "$notes" | grep -q 'aria-label="Topics"'
printf '%s' "$notes" | grep -q 'verse-count-pill'
if printf '%s' "$notes" | grep -q 'data-hub="eph.2.8"'; then
  echo "cookieless preview GET seeded a verse group" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'verse-group-peek'; then
  echo "chip peek is still on the topic row" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'Set rows'; then
  echo "set/folder preview toggle is still in the preview" >&2
  exit 1
fi
if printf '%s' "$notes" | grep -q 'Verse groups'; then
  echo "verse groups label is still in the preview" >&2
  exit 1
fi
topics=$(curl -fsS -A "Mozilla/5.0" -H "cache-control: no-cache" "$preview_url/notes?vg=topics")
printf '%s' "$topics" | grep -q 'id="verse-groups-view" open'
printf '%s' "$topics" | grep -q 'href="/notes?vg=topics#groups"'

echo "PREVIEW_URL=$preview_url/notes"
