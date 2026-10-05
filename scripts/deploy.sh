#!/bin/sh
# Publish with the project `cf`. Node >= 22.18 loads cloudflare.config.ts.
# Do not run this under Bun (`bunx cf`); Bun cannot load that config.
set -eu
mise exec -- cf deploy
url=https://margin-bible.dpshade.workers.dev/health
i=0
while [ "$i" -lt 5 ]; do
  body=$(curl -fsS -H "cache-control: no-cache" "$url" || true)
  if printf '%s' "$body" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
    printf '%s\n' "$body"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done
echo "Deploy finished but $url did not report ok." >&2
exit 1
