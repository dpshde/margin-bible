# D1 vs Durable Objects (2026-10-05)

Labs spike for Margin Bible storage. **Verdict: stay on D1.** Do not add Durable Objects (or a hybrid) until a pivot trigger below fires.

Forge accepted this KILL. Optional polish stays D1-native (batch note+xref writes; Sessions API only if D1 read replication is enabled).

## Snapshot (prod, sampled 2026-10-05)

| Fact | Value |
|------|--------|
| Bindings | Worker + D1 `DB` + `ASSETS` only (no DO / KV / R2) |
| D1 size | ~300 KB |
| Notes | 86 total (83 in primary library) |
| D1 batch latency | P50 ≈ 0.21 ms, P95 ≈ 0.97 ms |
| Export `listNotes` SQL | ≈ 2.1 ms |
| Worker wall | P50 ≈ 5 ms, 0 errors in sample |
| Soft-nav / inbox cache | Client `sessionStorage` + prefetch (not server KV) |
| MCP | `list_notes`, `export_library`, `personal_study`, … share the same D1 accessors as HTTP |
| Hidden Arrow proxy | No Margin D1; no per-user Margin rate-limit |

Tenant scope is `library_id` (session or MCP bearer). Note upsert + xref sync are sequential prepares today (auth paths already use `db.batch`).

## Why D1 wins today

- Read-heavy personal notebook; latency already sub-ms at SQL and low-ms at Worker wall.
- No realtime multi-device sync, presence, or WebSockets in the product.
- Soft-nav already solved in the browser; scripture is static `ASSETS`.
- MCP and `GET /export` are read-only over `listNotes` — a DO rewrite would touch every accessor for no measured win.
- CF guidance: D1 for serverless read-heavy apps; DO SQLite when you need per-entity coordination, colocated stateful compute, or realtime.

## D1-native polish (do before any DO)

1. **`db.batch` note+xref writes** — combine upsert and backlink saves; optionally RETURNING to drop the post-save `findNote`.
2. **Sessions API** — only if/when D1 read replication is turned on (`withSession` for read-your-writes after note PUT). Enabling replication without Sessions is the footgun.
3. **KV / Cache** — optional for public BSB/keyword only; never put private notes in KV.
4. **HA** — optional Worker token-bucket if upstream 429s return; unrelated to DO.

## Pivot when

Reopen this spike (MAYBE → KEEP) only when something **measurable** changes on our product side **or** in Cloudflare’s D1/DO primitives. Until then, KILL stands.

### What could change on our side (product / usage)

| Trigger | Why it matters | Likely direction |
|---------|----------------|------------------|
| **Realtime multi-device sync** (two open sessions must see each other’s edits live) | Last-write-wins UPSERT is not enough; need a serial or merge channel per library | Per-library DO (SQLite + hibernatable WebSockets / alarms), or hybrid DO for live channel + D1 mirror |
| **Presence / collab cursors / shared study session** | Needs coordination D1 cannot provide | DO room or per-library object |
| **Measured write contention** on one library that `db.batch` / transactions cannot fix (conflicts, lost xref updates under concurrent devices) | Product pain, not theory | Serialize writers in a per-library DO; keep D1 for auth/sessions if hybrid |
| **Library scale jump** — notes/export far beyond today’s ~83 notes / ~2 ms export (orders of magnitude: thousands of notes, heavy attachments, export timeouts) | Colocated per-tenant SQLite may beat shared D1 round-trips | Per-bound-library DO; guests stay on D1 |
| **Stronger isolation than `library_id` row filter** (compliance, tenant blast-radius, “library as unit of storage”) | Product/ops decision, not latency | Per-library DO as storage boundary |
| **Per-user scheduled work** (retention, digests, offline pack rebuild) tied to one library | Alarms are a DO primitive | Thin DO for alarms; notes can stay D1 until sync needs force a move |
| **Client offline-first sync protocol** with server conflict resolution | Needs an authoritative sequencer per library | DO as conflict/seq authority |

**Not** pivot triggers by themselves: soft-nav flicker (already client), HA 429s (proxy/upstream), wanting “modern CF stack,” or sub-millisecond SQL shaving.

### What could change in the underlying infra (D1 and DO)

| Change | Why it could flip the call | What we’d do |
|--------|----------------------------|--------------|
| **D1 gains** stronger multi-colo consistency, cheaper/faster transactions, or first-class per-tenant isolation that matches our library model | Makes staying on D1 even more correct; lowers pressure to move | Stay D1; adopt Sessions / new APIs; still no DO |
| **D1 read replication becomes default or required** with clearer Sessions semantics | We must use Sessions for read-your-writes; still not a DO reason | Enable Sessions on write→read paths; document footguns |
| **D1 write limits / pricing / latency regress** under our real load (not free-tier theory) | Shared DB becomes the bottleneck | Re-measure; if sustained, compare DO cost to D1 upgrade / sharding |
| **DO SQLite + RPC / hibernation / pricing** get simpler or cheaper for sparse personal apps | Lowers the ops tax of per-library objects (especially bound libraries only) | Re-run cost model for bound libraries; guests still D1 |
| **DO storage tooling** improves (dashboard query, export, migrations parity with D1) | Today DO loses easy ops vs D1 HTTP tooling | Removes a KILL reason; still need a product trigger |
| **Workers + DO become the recommended path for multi-tenant personal data** in CF guidance with clear migration stories | Changes default architecture for new features | Prefer DO for *new* coordinated features; migrate notes only if a product trigger also fires |
| **New CF primitive** (e.g. better Queues/Workflows, Smart Placement + D1) that covers coordination without DO | Prefer the thinner fix | Use that instead of DO |

**Rule of thumb:** pivot when we need **coordination or colocated per-library state** that D1 cannot express, *or* when infra pricing/limits make shared D1 worse than per-library DO for our measured load. Do not pivot for fashion or for features we have not shipped.

## Options considered (short)

| Option | Effort | Fit now |
|--------|--------|---------|
| A. Stay D1-only (+ native polish) | S–M | **Yes — recommended** |
| B. Per-library DO SQLite | L | Overbuilt; no current pain |
| C. Hybrid (DO hot path, D1 rest) | M–L | Dual source of truth; speculative |

## Source map (code)

- `wrangler.jsonc` — D1 + ASSETS only
- `src/index.ts` — HTTP note upsert, export, chapter, HA proxy
- `src/library.ts` — `listNotes` / `saveNote` / `findNote`
- `src/xref-sync.ts` — sequential backlink writes
- `src/mcp-tools.ts` — MCP read tools
- `src/ha-search.ts` — HA proxy (no D1)
- `src/reader-client.ts`, `src/inbox-ui.ts` — client soft-nav cache
- `migrations/0001–0004_*.sql`

Full Labs working notes (path map, comparison matrix, raw notes): kept under Labs artifacts from the 2026-10-05 spike; this file is the repo SoT for the decision.
