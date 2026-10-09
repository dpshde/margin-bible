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
  loginRateKey,
  mcpRateKey,
  publicApiRateKey,
  rateLimitIp,
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
  suggestTitleUsageCutoff,
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
      expect(updated).toContain('namespace: "91021"');
      expect(updated).toContain('namespace: "91022"');
      expect(updated).toContain('namespace: "91023"');
      expect(updated).toContain('namespace: "91024"');
      expect(updated).toContain('namespace: "91025"');
      expect(updated).not.toContain('namespace: "91011"');
      expect(updated).not.toContain('namespace: "91012"');
      expect(updated).not.toContain('namespace: "91013"');
      expect(updated).not.toContain('namespace: "91014"');
      expect(updated).not.toContain('namespace: "91015"');
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

  test("a failed login does not leave a guest library", async () => {
    const { sqlite, db } = guestSchema();
    sqlite.run("ALTER TABLE libraries ADD COLUMN passphrase_salt TEXT");
    sqlite.run("ALTER TABLE libraries ADD COLUMN passphrase_iterations INTEGER");
    sqlite.run("ALTER TABLE libraries ADD COLUMN label TEXT");
    sqlite.run(`CREATE TABLE auth_attempts (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    const env = { DB: db, ASSETS: assets, AUTH_PEPPER: "test-pepper" } as Env;
    const res = await app.request(
      "http://margin.test/login",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "passphrase=correct+horse+battery",
      },
      env,
    );
    expect(res.status).toBe(422);
    expect(res.headers.get("set-cookie")).toBeNull();
    const libraries = sqlite.query("SELECT COUNT(*) AS n FROM libraries").get() as { n: number };
    const sessions = sqlite.query("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
    expect(libraries.n).toBe(0);
    expect(sessions.n).toBe(0);
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
    expect(publicApiRateKey("203.0.113.8", "sess", "lib")).toBe("api:s:sess");
    expect(publicApiRateKey("203.0.113.8", null, "lib")).toBe("api:l:lib");
    expect(publicApiRateKey("203.0.113.8", null, null)).toBe("api:ip:203.0.113.8");
    expect(loginRateKey("203.0.113.8")).toBe("login:203.0.113.8");
    expect(mcpRateKey("203.0.113.8")).toBe("mcp:203.0.113.8");
  });

  test("IPv6 rate-limit keys use the /64 and IPv4 stays exact", () => {
    expect(rateLimitIp("203.0.113.8")).toBe("203.0.113.8");
    expect(rateLimitIp("::ffff:203.0.113.8")).toBe("203.0.113.8");
    expect(rateLimitIp("2001:db8:85a3::8a2e:370:7334")).toBe("2001:0db8:85a3:0000::/64");
    expect(rateLimitIp("2001:db8:85a3:0001::1")).toBe("2001:0db8:85a3:0001::/64");
    expect(rateLimitIp("::1")).toBe("0000:0000:0000:0000::/64");
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

  test("jump-suggest is exempt and other public API routes key by session or IP", async () => {
    const seen: string[] = [];
    const limiter: RateLimitBinding = {
      async limit(options) {
        seen.push(options.key);
        return { success: false };
      },
    };
    const env = { DB: throwingDb(), ASSETS: assets, PUBLIC_API_RATE_LIMIT: limiter } as Env;
    const jump = await app.request(
      "http://margin.test/api/jump-suggest?q=jhn",
      { headers: { "cf-connecting-ip": "2001:db8:85a3::8a2e:370:7334" } },
      env,
    );
    expect(jump.status).toBe(200);
    expect(seen).toEqual([]);

    const notes = await app.request(
      "http://margin.test/api/notes",
      { headers: { "cf-connecting-ip": "2001:db8:85a3::8a2e:370:7334" } },
      env,
    );
    expect(notes.status).toBe(429);
    expect(notes.headers.get("retry-after")).toBe("60");
    expect(seen).toEqual(["api:ip:2001:0db8:85a3:0000::/64"]);
  });

  test("a session keys the public API limit instead of the shared IP", async () => {
    const { sqlite, db } = guestSchema();
    const libraryId = "lib-session";
    const sessionId = "ab".repeat(32);
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 86_400_000).toISOString();
    sqlite.run("INSERT INTO libraries (id, created_at, updated_at) VALUES (?, ?, ?)", [libraryId, now, now]);
    sqlite.run("INSERT INTO sessions (id, library_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
      sessionId,
      libraryId,
      now,
      later,
    ]);
    const seen: string[] = [];
    const limiter: RateLimitBinding = {
      async limit(options) {
        seen.push(options.key);
        return { success: true };
      },
    };
    const env = { DB: db, ASSETS: assets, PUBLIC_API_RATE_LIMIT: limiter } as Env;
    const res = await app.request(
      "http://margin.test/api/notes",
      { headers: { cookie: `margin_session=${sessionId}`, "cf-connecting-ip": "203.0.113.8" } },
      env,
    );
    expect(res.status).toBe(200);
    expect(seen).toEqual([`api:s:${sessionId}`]);
  });

  test("login and MCP limits return 429 before any database write", async () => {
    const deny: RateLimitBinding = {
      async limit() {
        return { success: false };
      },
    };
    const env = {
      DB: throwingDb(),
      ASSETS: assets,
      LOGIN_RATE_LIMIT: deny,
      MCP_RATE_LIMIT: deny,
      PUBLIC_API_RATE_LIMIT: { async limit() { return { success: true }; } },
    } as Env;
    const login = await app.request(
      "http://margin.test/login",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "passphrase=not-a-real-phrase" },
      env,
    );
    expect(login.status).toBe(429);
    expect(login.headers.get("retry-after")).toBe("60");
    expect(login.headers.get("content-type")).toContain("text/html");

    const mcp = await app.request("http://margin.test/mcp", { method: "POST" }, env);
    expect(mcp.status).toBe(429);
    expect(mcp.headers.get("retry-after")).toBe("60");

    const options = await app.request("http://margin.test/mcp", { method: "OPTIONS" }, env);
    expect(options.status).toBe(204);
  });

  test("the config binding limits match the response windows", () => {
    const config = read("cloudflare.config.ts");
    expect(config).toContain('namespace: "91011"');
    expect(config).toContain('namespace: "91012"');
    expect(config).toContain('namespace: "91013"');
    expect(config).toContain('namespace: "91014"');
    expect(config).toContain('namespace: "91015"');
    expect(config).toContain("limit: 30");
    expect(config).toContain("limit: 10");
    expect(config).toContain("limit: 120");
    expect(config).toContain("limit: 20");
    expect(config).toContain("limit: 60");
    expect(config).toContain("period: 60");
    expect(config).toContain("bindings.rateLimit");
    expect(read("src/rate-limit.ts")).toContain(".limit({ key })");
    expect(read("src/index.ts")).toContain('version: "2026.10.09.59"');
    expect(read("scripts/preview-worker.sh")).toContain('preview_version="2026.10.09.59"');
    expect(read("src/reader-client.ts")).toContain("Slow down");
    expect(read("src/reader-client.ts")).toContain("retry-after");
    expect(read("src/reader-client.ts")).toContain("notes-rate-limit");
    expect(read("src/verse-groups-ui.ts")).toContain("queue.length >= 10");
    expect(read("src/verse-groups-ui.ts")).toContain("Could not name this topic.");
    expect(read("src/verse-groups-ui.ts")).toContain("if (storedTitle(cards[i])) continue;");
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

  test("old usage rows are removed and a full cap does not increment", async () => {
    const sqlite = new Database(":memory:");
    const db = memoryD1(sqlite);
    const now = new Date("2026-10-08T12:00:00.000Z");
    await consumeSuggestTitleQuota(db, "lib-1", "203.0.113.9", now);
    sqlite.run("INSERT INTO suggest_title_usage (actor, day, n) VALUES (?, ?, ?)", ["ip:stale", "2020-01-01", 9]);
    await consumeSuggestTitleQuota(db, "lib-1", "203.0.113.9", now);
    const stale = sqlite.query("SELECT n FROM suggest_title_usage WHERE day = ?").get("2020-01-01");
    expect(stale).toBeNull();
    expect(suggestTitleUsageCutoff(now)).toBe("2026-10-06");
    const library = sqlite
      .query("SELECT n FROM suggest_title_usage WHERE actor = ? AND day = ?")
      .get("lib:lib-1", "2026-10-08") as { n: number };
    expect(library.n).toBe(2);
    for (let n = 2; n < SUGGEST_TITLE_LIBRARY_DAILY_CAP; n += 1) {
      const result = await consumeSuggestTitleQuota(db, "lib-1", "198.51.100.8", now);
      expect(result.allowed).toBe(true);
    }
    const capped = await consumeSuggestTitleQuota(db, "lib-1", "198.51.100.8", now);
    expect(capped.allowed).toBe(false);
    const row = sqlite
      .query("SELECT n FROM suggest_title_usage WHERE actor = ? AND day = ?")
      .get("lib:lib-1", "2026-10-08") as { n: number };
    expect(row.n).toBe(SUGGEST_TITLE_LIBRARY_DAILY_CAP);
  });
});

describe("migrations 0005-0008 re-run", () => {
  test("0005 through 0008 can run twice, including when the worker already added the columns", () => {
    const fresh = new Database(":memory:");
    fresh.exec(read("migrations/0005_verse_groups.sql"));
    fresh.exec(read("migrations/0006_verse_group_auto_titled.sql"));
    fresh.exec(read("migrations/0006_verse_group_auto_titled.sql"));
    fresh.exec(read("migrations/0007_verse_group_external_refs.sql"));
    fresh.exec(read("migrations/0007_verse_group_external_refs.sql"));
    fresh.exec(read("migrations/0008_suggest_title_daily.sql"));
    fresh.exec(read("migrations/0008_suggest_title_daily.sql"));
    const columns = fresh.query("PRAGMA table_info(verse_groups)").all() as Array<{ name: string }>;
    const names = columns.map((column) => column.name);
    expect(names).toContain("auto_titled");
    expect(names).toContain("external_refs");

    const prod = new Database(":memory:");
    prod.exec(`CREATE TABLE verse_groups (
      library_id TEXT NOT NULL,
      hub_slug TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      undo_json TEXT NOT NULL DEFAULT '[]',
      star_slug TEXT NOT NULL DEFAULT '',
      jev_title TEXT NOT NULL DEFAULT '',
      external_refs TEXT NOT NULL DEFAULT '[]',
      auto_titled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (library_id, hub_slug)
    )`);
    prod.run(
      "INSERT INTO verse_groups (library_id, hub_slug, title, updated_at) VALUES (?, ?, ?, ?)",
      ["lib", "jhn.1.1", "In the beginning", "2026-10-01T00:00:00.000Z"],
    );
    prod.exec(read("migrations/0005_verse_groups.sql"));
    prod.exec(read("migrations/0006_verse_group_auto_titled.sql"));
    prod.exec(read("migrations/0006_verse_group_auto_titled.sql"));
    prod.exec(read("migrations/0007_verse_group_external_refs.sql"));
    const flagged = prod.query("SELECT auto_titled FROM verse_groups WHERE hub_slug = ?").get("jhn.1.1") as {
      auto_titled: number;
    };
    expect(flagged.auto_titled).toBe(1);
    expect(read("migrations/0006_verse_group_auto_titled.sql")).not.toMatch(/^ALTER TABLE/m);
    expect(read("migrations/0006_verse_group_auto_titled.sql")).not.toContain("backfills this flag");
    expect(read("migrations/0007_verse_group_external_refs.sql")).not.toMatch(/^ALTER TABLE/m);
  });
});
