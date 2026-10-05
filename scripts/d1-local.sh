#!/bin/sh
# Applies D1 migrations to the local state `cf dev` uses.
# The old wrangler.jsonc migrations_dir was "migrations".
# `cf dev` (Wrangler bundler) persists under .wrangler/state.
# `cf d1 --local` defaults to ~/.config/cloudflare/state, so --persist-to
# points this command at the dev server's directory.
set -eu
eval "$(sh scripts/cloudflare-env.sh)"
mise exec -- cf d1 migrations apply "$D1_ID" --local --dir migrations --persist-to .wrangler/state
