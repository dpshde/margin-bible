#!/bin/sh
# Print account and D1 ids from cloudflare.config.ts as shell exports.
# Does not read or print API tokens. Uses the Node version pinned in mise.toml.
set -eu
mise exec -- node scripts/cloudflare-env.mjs
