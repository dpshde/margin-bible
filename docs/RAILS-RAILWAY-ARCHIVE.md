# Rails + Railway archive (Margin Bible)

**Date:** 2026-09-30 (America/New_York / EDT)  
**Decision:** Cloudflare Workers is source of truth for Margin. Rails on Railway is retired.  
**This note:** pointers only — do not recreate Railway for Margin without reading this first.

## Current source of truth (keep)

| Piece | Value |
|---|---|
| Prod Worker URL | https://margin-bible.dpshade.workers.dev |
| Worker name | `margin-bible` |
| Code (box checkout) | `/workspace/margin-spike-deploy/prod/workers` |
| Worker config | `cloudflare.config.ts` → `name: margin-bible` |
| D1 database name | `margin-bible` |
| D1 database id | `0f48d232-f2d8-46c2-a8a3-3b36c4279feb` |
| CF account id (from prior migration) | `91ff2c2b757414041aeaa00896a8a43f` |
| Health check (2026-09-30) | `GET /health` → `{"ok":true,"app":"margin-bible","version":"2026.09.30.27"}` |
| Spike Worker (still exists; not prod) | https://margin-bible-spike.dpshade.workers.dev |

**Do not wipe CF D1 or the CF Worker as part of Rails teardown.**

Related migration write-up: `prod/workers/scripts/MIGRATION_REPORT.md` (2026-09-29 Rails → D1 import of library 96 / 63 notes).

---

## Railway project (Margin only — torn down 2026-09-30)

Confirmed via Railway MCP `list-projects` / `list-services` / `describe-environment`.  
**Untouched (not Margin):** `hidden-arrow` (`5e684670-2e61-4a3f-bd43-17294d51f146`), `route-bible-discord` (`9c7d8e6b-63bd-40a5-9d68-c8063ffa5da3`).

| Field | Value |
|---|---|
| Project name | `margin-bible` |
| Project id | `f08a65d2-1066-4552-9208-017c72b49017` |
| Workspace | Dylan Shade's Projects |
| Created | 2026-08-26T01:53:50.001Z |
| Environment | `production` (`bca8461f-470c-4d6b-b422-f0604e0c46fc`) |
| Region | `us-west2` |

### Services (pre-teardown inventory)

| Service | Id | Role | Notes |
|---|---|---|---|
| **web** | `4eb1d364-5984-47c5-b9dd-f670e00ec0ba` | Rails 8 app | Source repo `dpshde/margin-bible`; Dockerfile builder; `sleepApplication: true`; healthcheck `/up` |
| **Postgres** | `e269d474-43c1-4811-96d7-1cd042f3b457` | Postgres 18 SSL template | Image `ghcr.io/railwayapp-templates/postgres-ssl:18` |
| **inventory-query** | `0f696667-7d35-4047-9186-8c7a486ca632` | One-shot Bun function | Read-only SQL dump helper from 2026-09-29 migration; had staged delete pending |

### Domains (pre-teardown)

| Host | Service | Id |
|---|---|---|
| https://margin-bible.up.railway.app | web | `64e3697e-ca3f-4819-8a54-736ed0b064ec` |

No custom domains were attached on Railway for Margin at teardown time.  
`margin.bible` / `www.margin.bible` did **not** resolve from this box on 2026-09-30 (NXDOMAIN) — DNS cutover / Porkbun still a manual check.

### Volumes / buckets (pre-teardown)

| Resource | Id | Detail |
|---|---|---|
| Volume `postgres-volume` | `37d84922-8990-4571-ad66-c3b4098cf505` | 5000 MB, us-west2, mounted at `/var/lib/postgresql/data` |
| Bucket `Postgres-PITR` | `27340d59-f9d0-47da-8d47-528848152b37` | Region `sjc` |

### Last Railway deployments (pointers)

| When (UTC) | Service | Deployment id | Status | Git |
|---|---|---|---|---|
| 2026-09-29T19:32:03Z | inventory-query | `92bbe025-3bf7-4d87-94eb-451dc249332c` | SUCCESS | (function image) |
| 2026-09-29T17:14:24Z | web | `29ee0d61-b8da-4388-ae21-1160f85535f5` | SUCCESS | `main` @ `8ddc4c2` |
| 2026-09-26T20:26:44Z | Postgres | `7bd3af6c-967d-4437-b071-cb347a2c7b42` | SUCCESS | (image) |

Web env var **names** (values not exported by MCP): `APP_HOST`, `DATABASE_URL`, `MAIL_FROM`, `RAILS_ENV`, `RAILS_LOG_TO_STDOUT`, `RAILS_SERVE_STATIC_FILES`, `RESEND_API_KEY`, `SECRET_KEY_BASE`, `SOLID_QUEUE_IN_PUMA` (+ Railway injected `RAILWAY_*`).

No project webhooks.

---

## GitHub / git pointers

| Item | Value |
|---|---|
| Rails product repo | https://github.com/dpshde/margin-bible |
| Default branch | `main` |
| HEAD on teardown day | `8ddc4c2d135cc9bd6cdac1db003769515083b910` — *ci: path-filter + cancel-in-progress to cut Actions minutes* (2026-09-21) |
| Last Railway-deployed SHA | same `8ddc4c2` (web deployment 2026-09-29) |
| Notable prior merge | `76438f778fca2d2b8ec2f7678209d4b89b5cf1ed` — PR #26 inbox/MCP export (2026-09-11) |
| Workers D1 spike branch | `cursor/workers-d1-spike-2bc8` @ `3a06f788880b4201250ecc8118c864a6652f6f39` |
| Spike intro commit | `8e240d1df8ce7570a06cf9e3d0fb5332158dd765` — *Add a Workers + D1 labs spike…* |
| Box Rails+spike tree | `/workspace/margin-spike-deploy` (no `.git` in this checkout; treat GitHub as SoT for Rails history) |
| Repo config files | root `Dockerfile`, `railway.json` (healthcheck `/up`) |

Repo was **not** GitHub-archived by this cleanup (left readable). Archive or mark read-only on GitHub only if Dylan wants that UI signal.

### How to rediscover later

```text
# Railway
Railway MCP list-projects → look for name "margin-bible" / id f08a65d2-…
  (after teardown the empty project may remain until manually deleted in dashboard;
   there is no delete-project tool on the Railway MCP used here.)

# GitHub
https://github.com/dpshde/margin-bible
git clone git@github.com:dpshde/margin-bible.git
git log -1 --oneline          # expect 8ddc4c2… on main as of 2026-09-30
git log cursor/workers-d1-spike-2bc8 -1

# Cloudflare (live SoT)
curl -s https://margin-bible.dpshade.workers.dev/health
# code: /workspace/margin-spike-deploy/prod/workers
```

---

## Teardown actions (this cleanup)

Recorded after execution on **2026-09-30 ~14:48 EDT**:

| Action | Result |
|---|---|
| Document inventory (this file) | Done |
| Delete service **web** `4eb1d364-5984-47c5-b9dd-f670e00ec0ba` | **Deleted** (live) — `margin-bible.up.railway.app` gone |
| Delete service **inventory-query** `0f696667-7d35-4047-9186-8c7a486ca632` | **Deleted** live; a prior **staged** delete patch (`97d3080a-…`) still needs dashboard 2FA / discard |
| Delete service **Postgres** `e269d474-43c1-4811-96d7-1cd042f3b457` | **Deleted** (list-services empty; first call timed out, second said not found) |
| Delete volume **postgres-volume** `37d84922-8990-4571-ad66-c3b4098cf505` | **Deleted** |
| Delete bucket **Postgres-PITR** `27340d59-f9d0-47da-8d47-528848152b37` | **Deleted** |
| CF Worker + D1 | **Untouched** — `/health` still ok |
| Railway `hidden-arrow`, `route-bible-discord` | **Untouched** |
| GitHub-archive `dpshde/margin-bible` | **Not done** (noted only) |

Post-teardown check: `list-services` on project → no services. `GET https://margin-bible.up.railway.app/up` fails. CF prod `/health` still returns ok.

---

## Manual leftovers for Dylan

1. **Railway dashboard (2FA):** discard or apply leftover staged patch on env `production` (`bca8461f-…` / patch `97d3080a-4bf8-4350-9c6b-41bb40b1c09c`) that still references inventory-query delete — MCP `accept-deploy` refused without 2FA.
2. **Empty Railway project** `margin-bible` (`f08a65d2-…`) — MCP has no project-delete; delete the empty project in the Railway dashboard to fully stop any project-level billing/noise.
3. **DNS / Porkbun:** `margin.bible` / `www.margin.bible` currently do not resolve (NXDOMAIN from this box). Point apex/www at Cloudflare (Worker custom domain / CNAME to workers.dev) when ready; do not re-point at Railway.
4. **GitHub:** optional — archive repo, disconnect Railway GitHub deploy integration, trim Actions if still burning minutes.
5. **iOS / Hotwire:** release builds that used `MARGIN_BASE_URL` → Railway need a CF URL update (`cursor/ios-railway-release-url-620c` branch exists as historical pointer).
6. **Resend / magic-link / passkeys:** Rails auth path is gone; prod Workers passphrase flow is the live auth story (see `prod/workers/scripts/MIGRATION_REPORT.md` follow-ups).
7. **Todo** `margin-cost-dead` — mark done once dashboard confirms empty project deleted / billing stopped.
8. **Chapter-note UI (.26)** — separate deploy track; not part of this Rails teardown.

---

## Why teardown

Rails on Railway was in sleep mode but still cost-burning (Postgres volume, PITR bucket, occasional wake). Product decision: stay on Cloudflare Workers + D1. Prior inventory-query was only a read-only migration helper, not product surface.
