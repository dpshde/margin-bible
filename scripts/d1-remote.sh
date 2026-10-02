#!/bin/sh
# Applies migration files that the remote D1 database does not have yet.
# This is not part of `mise run deploy`. Run it on purpose.
set -eu
eval "$(sh scripts/cloudflare-env.sh)"
mise exec -- cf d1 migrations apply "$D1_ID"
