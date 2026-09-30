#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/assets/vendor/grab-bcv"
mkdir -p "$dest"
cp "$root/node_modules/grab-bcv/dist/parse.js" \
   "$root/node_modules/grab-bcv/dist/chunk-S3ACWDLD.js" \
   "$root/node_modules/grab-bcv/dist/chunk-DDWKUFQF.js" \
   "$dest/"
echo "Synced grab-bcv ESM into assets/vendor/grab-bcv"
