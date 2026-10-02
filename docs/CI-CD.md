# CI/CD

A laptop and GitHub Actions run the same [mise](https://mise.jdx.dev) tasks. Tool versions live in `mise.toml`: bun 1.4.2, node 22.23.3, and the Cloudflare CLI `cf` 1.0.0-beta.10. The `cf` pin is exact because an unpinned install resolves to an unrelated 0.x package.

There is no `prod` git branch. Production is the Worker `margin-bible`, published from `main`.

## Commands

| Command | What it does |
|---|---|
| `mise run ci` | Frozen `bun install`, `tsc`, `bun test`, then `wrangler deploy --dry-run` (bundle only, no upload) |
| `mise run deploy` | Frozen install, `wrangler deploy`, then `GET /health` until it reports ok |
| `mise run cf:whoami` | Shows the Cloudflare identity the pinned `cf` will use |
| `mise run d1:local` | Applies migrations to the local Miniflare database used by `wrangler dev` |
| `mise run d1:remote` | Applies migration files the remote D1 database does not have yet |

`mise install` once, from the repo root, installs those tools. The tasks call `mise exec`, so a system `bun` earlier on `PATH` cannot shadow the pin. `bun install` (without `--frozen-lockfile`) is how you update `bun.lock`. `mise run install` refuses a lockfile that does not match `package.json`.

## Why publish still uses Wrangler

This repo is a `wrangler.jsonc` project. `cf deploy` reads `cloudflare.config.ts` and only works after `cf migrate`. Loading that config also requires Node; `cf` fails when it is run under Bun. The publish command is therefore `bunx wrangler deploy`, which uses the Wrangler version in `bun.lock` (currently 4.146.0). GitHub and a laptop upload the same build.

`cf` is the CLI for account and D1 commands. It does not reuse a Wrangler login. `cf auth login` once on a laptop if you want `mise run d1:remote` or `mise run cf:whoami` without an API token. `mise run deploy` is happy with either that token or an existing `wrangler login`.

`account_id` in `wrangler.jsonc` is the account a publish targets. The workflow does not set `CLOUDFLARE_ACCOUNT_ID`, because an empty value would override the file.

## GitHub Actions

`.github/workflows/ci.yml` is the only workflow.

- Every pull request and every push to `main` runs `mise run ci`.
- A push to `main` (and a manual run on `main`) deploys only after that job succeeds. The deploy job uses the `production` environment and does not cancel an upload already in progress.
- The deploy job needs the repository secret `CLOUDFLARE_API_TOKEN`. Create a custom token with **Edit Cloudflare Workers**, scoped to this account only. Add it under Settings → Secrets and variables → Actions. Do not commit the token, and do not put it in `.dev.vars`.

Until that secret exists, the deploy job stops before it uploads. Publish from a machine that is already logged in:

```sh
mise run deploy
```

## Migrations

A push does not change the remote database. Schema changes are `mise run d1:remote`, which runs `cf d1 migrations apply` against the database id in `wrangler.jsonc`. Run that on purpose, with the code that needs the new schema.

Local migrations stay on Wrangler (`mise run d1:local`) so they hit the same Miniflare state as `bun run dev`. `cf d1 migrations apply --local` uses a different simulator.
