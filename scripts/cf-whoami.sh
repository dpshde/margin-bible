#!/bin/sh
# Confirms the Cloudflare credential can see the account pinned in cloudflare.config.ts.
set -eu
eval "$(sh scripts/cloudflare-env.sh)"
mise exec -- cf auth whoami | mise exec -- node scripts/cf-whoami.mjs
