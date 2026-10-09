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

`cf auth login` once on a laptop. `mise run deploy`, `mise run d1:remote`, `mise run cf:whoami`, and `scripts/preview-worker.sh` use that OAuth login. `cf` does not reuse a Wrangler login. Deploys run via Workers Builds on main or from the box via `mise run deploy` (OAuth); no CF API tokens.

`accountId` in `cloudflare.config.ts` is the account a publish targets. Commands do not set `CLOUDFLARE_ACCOUNT_ID`, because an empty value would override the file.

## GitHub Actions

`.github/workflows/ci.yml` is the only workflow.

- Every pull request and every push to `main` runs `mise run ci` (typecheck, tests, and `cf deploy --dry-run`).
- The dry-run bundles the Worker and exits before upload. It does not need a Cloudflare API token, so the check job stays tokenless.
- GitHub Actions does not deploy. Deploys run via Workers Builds on main or from the box via `mise run deploy` (OAuth); no CF API tokens.

```sh
mise run deploy
```

## Preview worker

`scripts/preview-worker.sh` publishes a separate Worker from a machine that has already run `cf auth login`. It clears any API token from the environment so `cf` uses the OAuth login. It still refuses the production D1 id and rewrites rate-limit namespaces 91011–91015 to 91021–91025. There is no GitHub workflow for that script.

## Workers Builds branch previews

Workers Builds runs `npx wrangler preview` on branches other than `main`. That command exits when the Wrangler config has no `previews` block.

`wrangler.config.ts` is tooling only (`defineWranglerConfig`: source maps, assets directory, typegen). That schema rejects a `previews` field, and the file does not hold D1 or rate-limit bindings. Those bindings live in `cloudflare.config.ts`, which also has no `previews` field. A classic `previews` block would have to live in `wrangler.jsonc`. `npx wrangler deploy` would read that file too. Putting only preview bindings there would drop the production D1 from a Wrangler production deploy. Copying the production D1 and namespaces 91011–91015 into the same file, beside a preview override, is a second source of truth that can drift from `cloudflare.config.ts`, and this repo cannot prove `wrangler preview` will ignore those top-level production bindings. This change does not add a `previews` block.

Turn branch previews off in the dashboard (manual step): Worker **margin-bible** → **Settings** → **Build** → **Branch control** → clear **Enable Preview Builds**. Production builds on `main` stay on. Preview deploys from the box stay `scripts/preview-worker.sh`.

## Migrations

A push does not change the remote database. Schema changes are `mise run d1:remote`, which runs `cf d1 migrations apply` against the database id in `cloudflare.config.ts` and `--dir migrations` (the old `migrations_dir`). Run that on purpose, with the code that needs the new schema.

`mise run d1:local` is the same command with `--local` and `--persist-to .wrangler/state`. `cf dev` persists there. A bare `cf d1 migrations apply --local` would use `~/.config/cloudflare/state` instead, which `cf dev` does not read.
