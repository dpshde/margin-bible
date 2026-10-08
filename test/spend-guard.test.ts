import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import app, { type Env } from "../src/index";
import { PREVIEW_D1_ID, PROD_D1_ID, previewSeedDecision, seedPreviewVerseGroups } from "../src/preview-seed";
import {
  haRateKey,
  publicApiRateKey,
  rateLimitedResponse,
  suggestRateKey,
  takeRateLimit,
  type RateLimitBinding,
} from "../src/rate-limit";
import {
  SUGGEST_TITLE_IP_DAILY_CAP,
  SUGGEST_TITLE_LIBRARY_DAILY_CAP,
  consumeSuggestTitleQuota,
  secondsUntilUtcDay,
} from "../src/suggest-title-cap";

const root = new URL("..", import.meta.url);

function read(name: string): string {
  return readFileSync(new URL(name, root), "utf8");
}

function memoryD1(sqlite: Database): D1Database {
  const statement = (sql: string, args: unknown[]) => ({
    sql,
    bind(...next: unknown[]) {
      return statement(sql, next);
    },
    async run() {
      if (args.length) sqlite.run(sql, args as never[]);
      else sqlite.run(sql);
      return { success: true, meta: { changes: sqlite.changes }, results: [] as unknown[] };
    },
    async all<T>() {
      const query = sqlite.query(sql);
      const results = args.length ? query.all(...(args as never[])) : query.all();
      return { results: results as T[], success: true };
    },
    async first<T>() {
      const query = sqlite.query(sql);
      const row = args.length ? query.get(...(args as never[])) : query.get();
      return (row as T | null) ?? null;
    },
  });
  return {
    prepare(sql: string) {
      return statement(sql, []);
    },
    async batch(statements: Array<{ sql?: string; all: () => Promise<unknown>; run: () => Promise<unknown> }>) {
      const out = [];
      for (const stmt of statements) {
        if (/^\s*select/i.test(stmt.sql ?? "")) out.push(await stmt.all());
        else out.push(await stmt.run());
      }
      return out;
    },
  } as unknown as D1Database;
}

function guestSchema(): { sqlite: Database; db: D1Database } {
  const sqlite = new Database(":memory:");
  sqlite.run(`CREATE TABLE libraries (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_read_slug TEXT,
    passphrase_lookup TEXT,
    passphrase_hash TEXT
  )`);
  sqlite.run(`CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);
  sqlite.run(`CREATE TABLE notes (
    library_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    osis TEXT NOT NULL,
    kind TEXT NOT NULL,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER,
    verse_end INTEGER,
    blocks TEXT NOT NULL,
    bookmarked INTEGER NOT NULL DEFAULT 0,
    attachments TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (library_id, slug)
  )`);
  return { sqlite, db: memoryD1(sqlite) };
}

function throwingDb(): D1Database {
  return {
    prepare() {
      throw new Error("cookieless read touched D1");
    },
  } as unknown as D1Database;
}

const assets = {
  fetch: async () => new Response("missing", { status: 404 }),
} as Env["ASSETS"];

describe("preview D1 isolation", () => {
  test("seed is allowed only for the preview database id", () => {
    expect(previewSeedDecision(undefined)).toBe("skip");
    expect(previewSeedDecision({})).toBe("skip");
    expect(previewSeedDecision({ PREVIEW_SEED: "1", D1_DATABASE_ID: PREVIEW_D1_ID })).toBe("allow");
    expect(previewSeedDecision({ PREVIEW_SEED: "1", D1_DATABASE_ID: PROD_D1_ID })).toBe("refuse");
    expect(previewSeedDecision({ PREVIEW_SEED: "1" })).toBe("refuse");
    expect(previewSeedDecision({ PREVIEW_SEED: "1", D1_DATABASE_ID: "not-the-preview-db" })).toBe("refuse");
  });

  test("a refused seed does not touch D1", async () => {
    const wrote = await seedPreviewVerseGroups(throwingDb(), "lib", [], {
      PREVIEW_SEED: "1",
      D1_DATABASE_ID: PROD_D1_ID,
    });
    expect(wrote).toBe(false);
  });

  test("the preview script rewrites the worker onto margin-bible-preview", () => {
    const script = read("scripts/preview-worker.sh");
    const py = script.match(/python3 - "\$cfg" "\$preview_name" <<'PY'\n([\s\S]*?)\nPY/)?.[1];
    expect(py).toBeTruthy();
    const dir = mkdtempSync(join(tmpdir(), "margin-preview-"));
    try {
      const cfg = join(dir, "cloudflare.config.ts");
      const program = join(dir, "rewrite.py");
      writeFileSync(cfg, read("cloudflare.config.ts"));
      writeFileSync(program, py ?? "");
      const result = spawnSync("python3", [program, cfg, "margin-bible-verse-groups"], { encoding: "utf8" });
      expect(result.status).toBe(0);
      const updated = readFileSync(cfg, "utf8");
      expect(updated).toContain('name: "margin-bible-verse-groups"');
      expect(updated).toContain('name: "margin-bible-preview"');
      expect(updated).toContain(`id: "${PREVIEW_D1_ID}"`);
      expect(updated).toContain(`D1_DATABASE_ID: bindings.text("${PREVIEW_D1_ID}")`);
      expect(updated).toContain('PREVIEW_SEED: bindings.text("1")');
      expect(updated).not.toContain(PROD_D1_ID);
      expect(updated).not.toContain('name: "margin-bible"');
      expect(updated).toContain("bindings.rateLimit");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("verse group backfill stays off GET", () => {
  test("the request path no longer runs the full-table auto_titled update", () => {
    const store = read("src/verse-groups-store.ts");
    const index = read("src/index.ts");
    expect(store).not.toContain("UPDATE verse_groups SET auto_titled = 1 WHERE auto_titled = 0");
    expect(index).not.toContain("UPDATE verse_groups SET auto_titled");
    expect(read("migrations/0006_verse_group_auto_titled.sql")).toContain("trim(title) != ''");
  });
});

describe("lazy guest library", () => {
  test("a cookieless GET does not create a library or a session", async () => {
    const env = { DB: throwingDb(), ASSETS: assets } as Env;
    const notes = await app.request("http://margin.test/notes", {}, env);
    expect(notes.status).toBe(200);
    expect(notes.headers.get("set-cookie")).toBeNull();
    expect(await notes.text()).toContain("No topics yet");

    const api = await app.request("http://margin.test/api/notes", {}, env);
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ ok: true, notes: [], signedIn: false });
    expect(api.headers.get("set-cookie")).toBeNull();

    const groups = await app.request("http://margin.test/api/verse-groups", {}, env);
    expect(groups.status).toBe(200);
    expect(await groups.json()).toEqual({ ok: true, groups: [] });

    const home = await app.request("http://margin.test/", {}, env);
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("/jhn.1");
    expect(home.headers.get("set-cookie")).toBeNull();

    const chapter = await app.request("http://margin.test/jhn.1", {}, env);
    expect(chapter.status).toBe(404);
    expect(chapter.headers.get("set-cookie")).toBeNull();
  });

  test("the first note save creates one guest library and later views reuse it", async () => {
    const { sqlite, db } = guestSchema();
    const env = { DB: db, ASSETS: assets } as Env;
    const saved = await app.request(
      "http://margin.test/api/notes/jhn.1.1",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "In the beginning." }),
      },
      env,
    );
    expect(saved.status).toBe(200);
    const cookie = saved.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("margin_session=");
    const libraries = sqlite.query("SELECT COUNT(*) AS n FROM libraries").get() as { n: number };
    const sessions = sqlite.query("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
    expect(libraries.n).toBe(1);
    expect(sessions.n).toBe(1);

    const again = await app.request(
      "http://margin.test/api/notes",
      { headers: { cookie: cookie.split(";")[0] } },
      env,
    );
    expect(again.status).toBe(200);
    const body = (await again.json()) as { notes: Array<{ slug: string }> };
    expect(body.notes.map((note) => note.slug)).toEqual(["jhn.1.1"]);
    const librariesAfter = sqlite.query("SELECT COUNT(*) AS n FROM libraries").get() as { n: number };
    expect(librariesAfter.n).toBe(1);
  });
});

describe("rate limits", () => {
  test("429 carries Retry-After", async () => {
    const res = rateLimitedResponse(60, "Too many requests. Try again in a minute.");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ ok: false, error: "Too many requests. Try again in a minute." });
  });

  test("keys separate Hidden Arrow, suggest-title, and other API routes", () => {
    expect(haRateKey("203.0.113.8")).toBe("ha:203.0.113.8");
    expect(suggestRateKey("203.0.113.8", null)).toBe("suggest:ip:203.0.113.8");
    expect(suggestRateKey("203.0.113.8", "abc")).toBe("suggest:s:abc");
    expect(publicApiRateKey("203.0.113.8")).toBe("api:203.0.113.8");
  });

  test("a failing Hidden Arrow limit returns 429 and does not call upstream", async () => {
    const seen: string[] = [];
    const limiter: RateLimitBinding = {
      async limit(options) {
        seen.push(options.key);
        return { success: options.key.startsWith("api:") };
      },
    };
    let called = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const env = {
        DB: throwingDb(),
        ASSETS: assets,
        HIDDEN_ARROW_SEARCH_KEY: "test-search-key",
        HA_RATE_LIMIT: limiter,
        PUBLIC_API_RATE_LIMIT: limiter,
      } as Env;
      const res = await app.request(
        "http://margin.test/api/ha-search",
        {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.8" },
          body: JSON.stringify({ query: "neighbor" }),
        },
        env,
      );
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("60");
      expect(called).toBe(0);
      expect(seen).toEqual(["ha:203.0.113.8"]);
    } finally {
      globalThis.fetch = real;
    }
  });

  test("other public API routes use the shared per-IP limit", async () => {
    const limiter: RateLimitBinding = {
      async limit() {
        return { success: false };
      },
    };
    const env = { DB: throwingDb(), ASSETS: assets, PUBLIC_API_RATE_LIMIT: limiter } as Env;
    const res = await app.request("http://margin.test/api/jump-suggest?q=jhn", {}, env);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  test("the config binding limits match the response windows", () => {
    const config = read("cloudflare.config.ts");
    expect(config).toContain('namespace: "91011"');
    expect(config).toContain('namespace: "91012"');
    expect(config).toContain('namespace: "91013"');
    expect(config).toContain("limit: 30");
    expect(config).toContain("limit: 10");
    expect(config).toContain("limit: 120");
    expect(config).toContain("period: 60");
    expect(config).toContain("bindings.rateLimit");
    expect(read("src/rate-limit.ts")).toContain(".limit({ key })");
  });
});

describe("suggest-title daily cap", () => {
  test("seconds until UTC midnight is at least one", () => {
    const now = new Date("2026-10-08T23:59:30.000Z");
    expect(secondsUntilUtcDay(now)).toBe(30);
  });

  test("a library and an IP stop at their daily caps", async () => {
    const sqlite = new Database(":memory:");
    const db = memoryD1(sqlite);
    const now = new Date("2026-10-08T12:00:00.000Z");
    for (let n = 0; n < SUGGEST_TITLE_LIBRARY_DAILY_CAP; n += 1) {
      const result = await consumeSuggestTitleQuota(db, "lib-1", "203.0.113.9", now);
      expect(result.allowed).toBe(true);
    }
    const blocked = await consumeSuggestTitleQuota(db, "lib-1", "203.0.113.9", now);
    expect(blocked.allowed).toBe(false);
    if (blocked.allowed) return;
    expect(blocked.retryAfterSec).toBe(secondsUntilUtcDay(now));

    const otherLibrary = await consumeSuggestTitleQuota(db, "lib-2", "203.0.113.9", now);
    expect(otherLibrary.allowed).toBe(true);

    for (let n = SUGGEST_TITLE_LIBRARY_DAILY_CAP + 1; n < SUGGEST_TITLE_IP_DAILY_CAP; n += 1) {
      const result = await consumeSuggestTitleQuota(db, `lib-${n}`, "203.0.113.9", now);
      expect(result.allowed).toBe(true);
    }
    const ipBlocked = await consumeSuggestTitleQuota(db, "lib-fresh", "203.0.113.9", now);
    expect(ipBlocked.allowed).toBe(false);
  });
});
