/**
 * Daily TypeSafe cap for suggest-title.
 * The Workers Rate Limiting binding only accepts a 10s or 60s period, so the
 * calendar day is counted in D1. One row per actor per UTC day.
 */

export const SUGGEST_TITLE_LIBRARY_DAILY_CAP = 24;
export const SUGGEST_TITLE_IP_DAILY_CAP = 40;

const CREATE_USAGE = `CREATE TABLE IF NOT EXISTS suggest_title_usage (
  actor TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (actor, day)
)`;

const usageReady = new WeakMap<D1Database, Promise<void>>();

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Seconds until the next UTC midnight. Retry-After for a daily cap. */
export function secondsUntilUtcDay(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function suggestTitleLibraryActor(libraryId: string): string {
  return `lib:${libraryId}`;
}

export function suggestTitleIpActor(ip: string): string {
  return `ip:${ip}`;
}

async function migrateSuggestTitleUsage(db: D1Database): Promise<void> {
  await db.prepare(CREATE_USAGE).run();
}

export async function ensureSuggestTitleUsage(db: D1Database): Promise<void> {
  let pending = usageReady.get(db);
  if (!pending) {
    pending = migrateSuggestTitleUsage(db).catch((err) => {
      usageReady.delete(db);
      throw err;
    });
    usageReady.set(db, pending);
  }
  await pending;
}

/** Rows older than this UTC day are removed. Keeps today and the two days before it. */
export function suggestTitleUsageCutoff(now = new Date()): string {
  const prior = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2));
  return prior.toISOString().slice(0, 10);
}

/**
 * One conditional upsert. RETURNING is empty when the row is already at the cap,
 * so a racing pair cannot both pass a read-then-increment.
 */
async function claimUsage(db: D1Database, actor: string, day: string, cap: number): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO suggest_title_usage (actor, day, n) VALUES (?, ?, 1)
       ON CONFLICT(actor, day) DO UPDATE SET n = n + 1
       WHERE suggest_title_usage.n < ?
       RETURNING n`,
    )
    .bind(actor, day, cap)
    .all<{ n: number }>();
  return result.results.length > 0;
}

export type SuggestTitleQuota =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

/**
 * Counts one paid suggest-title attempt for this library and this IP.
 * A library over its cap or an IP over its cap is refused before TypeSafe is called.
 */
export async function consumeSuggestTitleQuota(
  db: D1Database,
  libraryId: string,
  ip: string,
  now = new Date(),
): Promise<SuggestTitleQuota> {
  await ensureSuggestTitleUsage(db);
  const day = utcDay(now);
  await db.prepare("DELETE FROM suggest_title_usage WHERE day < ?").bind(suggestTitleUsageCutoff(now)).run();
  const libraryClaimed = await claimUsage(db, suggestTitleLibraryActor(libraryId), day, SUGGEST_TITLE_LIBRARY_DAILY_CAP);
  if (!libraryClaimed) return { allowed: false, retryAfterSec: secondsUntilUtcDay(now) };
  const ipClaimed = await claimUsage(db, suggestTitleIpActor(ip), day, SUGGEST_TITLE_IP_DAILY_CAP);
  if (!ipClaimed) return { allowed: false, retryAfterSec: secondsUntilUtcDay(now) };
  return { allowed: true };
}
