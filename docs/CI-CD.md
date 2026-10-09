# CI/CD

A laptop and GitHub Actions run the same [mise](https://mise.jdx.dev) tasks. Tool versions live in `mise.toml`: bun 1.4.2, node 22.23.3, and the Cloudflare CLI `cf` 1.0.0-beta.13 (the first release with `cf workers versions profile`). The `cf` pin is exact because an unpinned install resolves to an unrelated 0.x package. `package.json` depends on the same `cf` release; a `cf` binary on `PATH` hands off to that copy inside this repo.

There is no `prod` git branch. Production is the Worker `margin-bible`, published from `main`.

## Commands

| Command | What it does |
|---|---|
| `mise run ci` | Frozen `bun install`, `tsc`, `bun test`, then `cf deploy --dry-run` (bundle only, no upload) |
| `mise run deploy` | Frozen install, `cf deploy`, then `GET /health` until it reports ok |
| `mise run cf:whoami` | Shows the Cloudflare identity the pinned `cf` will use |
| `mise run d1:local` | Applies migrations to the local database used by `cf dev` |
| `mise run d1:remote` | Applies migration files the remote D1 database does not have yet |

`mise install` once, from the repo root, installs those tools. The tasks call `mise exec`, so a system `bun` earlier on `PATH` cannot shadow the pin. `bun install` (without `--frozen-lockfile`) is how you update `bun.lock`. `mise run install` refuses a lockfile that does not match `package.json`.

## Publish with `cf`

Worker settings live in `cloudflare.config.ts`. `cf` ignores `wrangler.jsonc` once that file exists, so the Wrangler config file is not in this repo. Build settings that Wrangler still owns (the assets directory) live in `wrangler.config.ts`. The project keeps the Wrangler bundler: `@cloudflare/vite-plugin` is not installed, and `cf migrate` chose Wrangler for that reason. Wrangler stays a devDependency because `cf dev`, `cf build`, and `cf deploy` run it.

`cf` loads `cloudflare.config.ts` with Node. That needs Node ≥ 22.18. `mise.toml` pins 22.23.3, and `mise exec -- cf` uses that Node. Bun cannot load `cloudflare.config.ts`, so do not run `bunx cf`. `bun run dev`, `bun run deploy`, and `bun run dry-run` are fine when `node` on `PATH` is new enough (`mise exec -- bun run dev`). App tests and `bun run check` stay on Bun.

`cf auth login` once on a laptop if you want `mise run d1:remote` or `mise run cf:whoami` without an API token. `mise run deploy` uses that login or `CLOUDFLARE_API_TOKEN`. `cf` does not reuse a Wrangler login.

`accountId` in `cloudflare.config.ts` is the account a publish targets. The workflow does not set `CLOUDFLARE_ACCOUNT_ID`, because an empty value would override the file.

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

A push does not change the remote database. Schema changes are `mise run d1:remote`, which runs `cf d1 migrations apply` against the database id in `cloudflare.config.ts` and `--dir migrations` (the old `migrations_dir`). Run that on purpose, with the code that needs the new schema.

`mise run d1:local` is the same command with `--local` and `--persist-to .wrangler/state`. `cf dev` persists there. A bare `cf d1 migrations apply --local` would use `~/.config/cloudflare/state` instead, which `cf dev` does not read.
