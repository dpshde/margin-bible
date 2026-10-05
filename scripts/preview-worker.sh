#!/bin/sh
# Publish this checkout as a separate Worker. Does not deploy `margin-bible`.
# The D1 binding stays the production database. The worker creates `verse_groups`
# on first use (CREATE TABLE IF NOT EXISTS). It does not run migrations.
set -eu

preview_name="margin-bible-verse-groups"
preview_url="https://${preview_name}.dpshade.workers.dev"
cfg="cloudflare.config.ts"
bak="${cfg}.preview-bak"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "Missing CLOUDFLARE_API_TOKEN." >&2
  exit 1
fi

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
file = pathlib.Path(path)
text = file.read_text()
old = 'name: "margin-bible"'
new = f'name: "{preview}"'
if old not in text:
    raise SystemExit("worker name anchor missing")
file.write_text(text.replace(old, new, 1))
updated = file.read_text()
if f'name: "{preview}"' not in updated:
    raise SystemExit("preview worker name missing")
if updated.count('name: "margin-bible"') != 1:
    raise SystemExit("expected the D1 binding name to stay margin-bible")
if 'id: "0f48d232-f2d8-46c2-a8a3-3b36c4279feb"' not in updated:
    raise SystemExit("D1 id changed")
PY

mise exec -- cf deploy

prod=$(curl -fsS -H "cache-control: no-cache" "https://margin-bible.dpshade.workers.dev/health" || true)
printf '%s\n' "$prod"
if printf '%s' "$prod" | grep -q '2026.10.05.1'; then
  echo "production worker is serving this preview build" >&2
  exit 1
fi

i=0
body=""
while [ "$i" -lt 12 ]; do
  body=$(curl -fsS -H "cache-control: no-cache" "$preview_url/health" || true)
  printf '%s\n' "$body"
  if printf '%s' "$body" | grep -q '2026.10.05.1'; then
    break
  fi
  i=$((i + 1))
  sleep 3
done
printf '%s' "$body" | grep -q '2026.10.05.1'

notes=$(curl -fsS -H "cache-control: no-cache" "$preview_url/notes")
printf '%s' "$notes" | grep -q 'id="verse-groups-btn"'
printf '%s' "$notes" | grep -q 'data-hub="rom.9.17"'
printf '%s' "$notes" | grep -q 'Add the cross-links in this web'

echo "PREVIEW_URL=$preview_url/notes"
