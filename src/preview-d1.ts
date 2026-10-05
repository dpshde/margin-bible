/**
 * D1-shaped wrapper around bun:sqlite for the preview host.
 * The Worker keeps using Cloudflare D1. This file is only the preview process.
 */
import { readdirSync, readFileSync } from "node:fs";
import { Database } from "bun:sqlite";

type RunResult = { changes: number; lastInsertRowid: number | bigint };

export function openPreviewDatabase(filename = ":memory:"): D1Database {
  const sqlite = new Database(filename);
  sqlite.exec("PRAGMA journal_mode = WAL");
  applyMigrations(sqlite);
  return asD1(sqlite);
}

function applyMigrations(sqlite: Database): void {
  sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)");
  const dir = new URL("../migrations/", import.meta.url);
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied = new Set(
    sqlite
      .query("SELECT name FROM schema_migrations")
      .all()
      .map((row) => String((row as { name: string }).name)),
  );
  for (const name of names) {
    if (applied.has(name)) continue;
    const sql = readFileSync(new URL(name, dir), "utf8");
    sqlite.exec(sql);
    sqlite.query("INSERT INTO schema_migrations (name) VALUES (?)").run(name);
  }
}

function asD1(sqlite: Database): D1Database {
  return {
    prepare(query: string) {
      return statement(sqlite, query, []);
    },
    async batch(statements: D1PreparedStatement[]) {
      const results = [];
      for (const stmt of statements) results.push(await stmt.run());
      return results;
    },
    async exec() {
      return { count: 0, duration: 0 };
    },
  } as D1Database;
}

function statement(sqlite: Database, query: string, params: unknown[]): D1PreparedStatement {
  const bound = {
    bind(...values: unknown[]) {
      return statement(sqlite, query, values);
    },
    async run() {
      const result = sqlite.query(query).run(...params) as RunResult;
      return {
        success: true,
        meta: { changes: Number(result?.changes ?? 0), last_row_id: Number(result?.lastInsertRowid ?? 0) },
      };
    },
    async all() {
      const results = sqlite.query(query).all(...params);
      return { success: true, results, meta: { changes: 0 } };
    },
    async first() {
      return sqlite.query(query).get(...params) ?? null;
    },
    async raw() {
      return sqlite.query(query).values(...params);
    },
  };
  return bound as D1PreparedStatement;
}
