/**
 * One automatic title for a verse group: BSB text of the hub and members,
 * then one Jev Choice. The starred chip is unchanged.
 *
 * The pass runs only while `autoTitled` is false and the saved title is empty.
 * A missing TYPESAFE_API_KEY leaves the placeholder and does not set the flag,
 * so a later request can still name the group. The caller must not retry in a loop.
 * Jev answering None sets the flag and leaves the placeholder.
 */
import { nearestVerseTopic } from "./jev";
import { listNotes } from "./library";
import { canonSlug, cleanGroupTitle, NOT_A_VERSE_GROUP, type VerseGroupView } from "./verse-groups";
import { consumeSuggestTitleQuota } from "./suggest-title-cap";
import {
  claimOpenTitle,
  ensureVerseGroupsTable,
  loadVerseGroups,
  markVerseGroupAutoTitled,
  saveAutoTitle,
} from "./verse-groups-store";
import { bsbLinesForSlugs, type AssetFetch } from "./verse-text";

export type TopicSkip = "already" | "no-key" | "no-topic" | "unavailable";

export type TopicSuggestion =
  | { ok: true; topic: string; group: VerseGroupView; skipped?: TopicSkip }
  | { ok: false; status: 422 | 429; error: string; retryAfterSec?: number };

export async function suggestVerseGroupTopic(input: {
  db: D1Database;
  assets: AssetFetch;
  libraryId: string;
  hub: string;
  /** Title currently in the field. A non-empty value is the reader's title, so Jev is not called. */
  postedTitle?: unknown;
  apiKey?: string | null;
  /** Connecting IP, for the per-IP daily TypeSafe cap. */
  clientIp?: string;
  fetchImpl?: typeof fetch;
}): Promise<TopicSuggestion> {
  await ensureVerseGroupsTable(input.db);
  const hub = canonSlug(input.hub);
  if (!hub) return { ok: false, status: 422, error: "unresolvable hub" };
  const notes = await listNotesSafe(input.db, input.libraryId);
  const group = notes.groups.find((row) => row.hub === hub);
  if (!group) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  if (group.autoTitled) {
    return { ok: true, topic: group.title, group, skipped: "already" };
  }

  if (group.title.trim()) {
    await markVerseGroupAutoTitled(input.db, input.libraryId, hub);
    const fresh = await groupFor(input.db, input.libraryId, hub);
    return {
      ok: true,
      topic: fresh?.title || group.title,
      group: fresh ?? { ...group, autoTitled: true },
      skipped: "already",
    };
  }

  const posted = input.postedTitle === undefined ? "" : cleanGroupTitle(input.postedTitle);
  if (posted) {
    const wrote = await claimOpenTitle(input.db, input.libraryId, hub, posted);
    const fresh = await groupFor(input.db, input.libraryId, hub);
    if (wrote && fresh) return { ok: true, topic: fresh.title, group: fresh, skipped: "already" };
    if (fresh?.autoTitled || fresh?.title.trim()) {
      return { ok: true, topic: fresh?.title ?? "", group: fresh ?? group, skipped: "already" };
    }
  }

  const apiKey = String(input.apiKey ?? "").trim();
  if (!apiKey) return { ok: true, topic: "", group, skipped: "no-key" };

  const lines = await bsbLinesForSlugs(
    input.assets,
    group.members.map((member) => member.slug),
  );
  if (!lines.length) return { ok: true, topic: "", group, skipped: "unavailable" };

  const quota = await consumeSuggestTitleQuota(input.db, input.libraryId, input.clientIp ?? "unknown");
  if (!quota.allowed) {
    return {
      ok: false,
      status: 429,
      error: "Title suggestions for this library are capped until tomorrow.",
      retryAfterSec: quota.retryAfterSec,
    };
  }

  const takenTitles = notes.groups.filter((row) => row.hub !== hub).map((row) => row.title);
  const topic = await nearestVerseTopic(lines, {
    apiKey,
    fetchImpl: input.fetchImpl,
    takenTitles,
  });
  if (!topic.ok) {
    if (topic.error === "No close topic for these verses.") {
      await markVerseGroupAutoTitled(input.db, input.libraryId, hub);
      const fresh = await groupFor(input.db, input.libraryId, hub);
      return {
        ok: true,
        topic: "",
        group: fresh ?? { ...group, autoTitled: true },
        skipped: "no-topic",
      };
    }
    return { ok: true, topic: "", group, skipped: topic.status === 503 ? "no-key" : "unavailable" };
  }

  const wrote = await saveAutoTitle(input.db, input.libraryId, hub, topic.topic);
  const fresh = await groupFor(input.db, input.libraryId, hub);
  if (!wrote) {
    return {
      ok: true,
      topic: fresh?.title ?? group.title,
      group: fresh ?? group,
      skipped: "already",
    };
  }
  return {
    ok: true,
    topic: fresh?.title || topic.topic,
    group: fresh ?? { ...group, title: topic.topic, autoTitled: true, titleFromJev: true },
  };
}

async function listNotesSafe(db: D1Database, libraryId: string): Promise<{ groups: VerseGroupView[] }> {
  const notes = await listNotes(db, libraryId);
  const groups = await loadVerseGroups(db, libraryId, notes);
  return { groups };
}

async function groupFor(db: D1Database, libraryId: string, hub: string): Promise<VerseGroupView | null> {
  const notes = await listNotesSafe(db, libraryId);
  return notes.groups.find((row) => row.hub === hub) ?? null;
}
