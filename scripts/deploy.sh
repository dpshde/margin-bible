#!/bin/sh
# Publish with the Wrangler version locked in bun.lock, then wait until /health answers.
# `cf deploy` is not used: this project is wrangler.jsonc, and cf deploy reads cloudflare.config.ts.
set -eu
mise exec -- bunx wrangler deploy
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
