# CI/CD (Workers SoT)

## Current state (2026-09-30 cutover)

| Path | Status |
|------|--------|
| GitHub Actions `CI` (Rails Ruby/Node) | **Removed** with Rails `main` — archived under tag `rails-archive-2026-09-30` |
| Workers GitHub Actions | **New** — `.github/workflows/ci.yml` runs `bun install` + `tsc` + `bun test` via [mise](https://mise.jdx.dev) |
| Workers deploy from Actions | **Scaffolded** in `.github/workflows/deploy.yml` but **blocked** until repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist |
| Live production deploy | Box / laptop: `mise install && bun install && bunx wrangler deploy` (Wrangler OAuth or API token locally) |

## Toolchain

See `mise.toml` at repo root (`bun` 1.4.2, `node` 22). Prefer `mise run ci` locally.
