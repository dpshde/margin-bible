/**
 * Persist a web's name beside the hub slug. Xref sync keeps owning the chips,
 * so a title survives a backlink write.
 *
 * A hub has to already exist in the library. This store does not invent a sample mesh.
 * Pairwise cross-links are a separate confirm action.
 */
import { newAttachmentId, noteIsEmpty, type Attachment } from "./attachments";
import { deleteNote, findNote, listNotes, saveNote } from "./library";
import { parsePassage, passageOsis, passageSlug } from "./passage";
import { syncBidirectionalXrefs } from "./xref-sync";
import {
  canonSlug,
  cleanGroupDescription,
  cleanGroupTitle,
  realVerseGroups,
  verseGroupsFromNotes,
  verseMemberFromInput,
  withManualXref,
  withoutUserXref,
  type GroupNote,
  type VerseGroupMeta,
  type VerseGroupView,
} from "./verse-groups";
import type { NoteDraft } from "./notes";

const CREATE_VERSE_GROUPS = `CREATE TABLE IF NOT EXISTS verse_groups (
  library_id TEXT NOT NULL,
  hub_slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  undo_json TEXT NOT NULL DEFAULT '[]',
  star_slug TEXT NOT NULL DEFAULT '',
  jev_title TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (library_id, hub_slug)
)`;

type MetaRow = {
  hub_slug: string;
  title: string;
  description: string;
  undo_json: string | null;
  star_slug?: string | null;
  jev_title?: string | null;
};

export type VerseGroupActionResult =
  | { ok: true; statusText: string; group: VerseGroupView }
  | { ok: false; status: 422 | 500; error: string };

export async function loadVerseGroups(
  db: D1Database,
  libraryId: string,
  notes: readonly GroupNote[],
): Promise<VerseGroupView[]> {
  let metas: VerseGroupMeta[] = [];
  try {
    await ensureVerseGroupsTable(db);
    metas = await listVerseGroupMeta(db, libraryId);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "verse_groups_meta_unavailable",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  return verseGroupsFromNotes(notes, metas);
}

export async function handleVerseGroupAction(
  db: D1Database,
  libraryId: string,
  body: unknown,
): Promise<VerseGroupActionResult> {
  if (!body || typeof body !== "object") return { ok: false, status: 422, error: "invalid json" };
  const record = body as Record<string, unknown>;
  const action = record.action;
  const hub = canonSlug(typeof record.hub === "string" ? record.hub : "");
  if (!hub) return { ok: false, status: 422, error: "unresolvable hub" };
  if (
    action !== "save" &&
    action !== "add-links" &&
    action !== "undo-links" &&
    action !== "add-member" &&
    action !== "remove-member" &&
    action !== "set-star"
  ) {
    return { ok: false, status: 422, error: "unknown action" };
  }
  try {
    await ensureVerseGroupsTable(db);
    if (action === "save") {
      return await saveVerseGroup(db, libraryId, hub, {
        title: cleanGroupTitle(record.title),
        description: cleanGroupDescription(record.description),
      });
    }
    if (action === "add-member") return await addVerseMember(db, libraryId, hub, record.text);
    if (action === "remove-member") return await removeVerseMember(db, libraryId, hub, record.slug);
    if (action === "set-star") return await setVerseStar(db, libraryId, hub, record.slug);
    if (action === "add-links") return await addVerseGroupLinks(db, libraryId, hub);
    return await undoVerseGroupLinks(db, libraryId, hub);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "verse_groups_action_failed",
        action,
        hub,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { ok: false, status: 500, error: "Could not update that web." };
  }
}

async function saveVerseGroup(
  db: D1Database,
  libraryId: string,
  hub: string,
  text: { title: string; description: string },
): Promise<VerseGroupActionResult> {
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  await upsertVerseGroupText(db, libraryId, hub, text.title, text.description);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: "Saved.", group };
}

async function addVerseMember(
  db: D1Database,
  libraryId: string,
  hub: string,
  raw: unknown,
): Promise<VerseGroupActionResult> {
  const parsed = verseMemberFromInput(raw);
  if (!parsed.ok) return { ok: false, status: 422, error: parsed.error };
  if (parsed.slug === hub) return { ok: false, status: 422, error: "Already attached." };
  const seen = await groupForHub(db, libraryId, hub);
  if (seen?.members.some((member) => member.slug === parsed.slug)) {
    return { ok: false, status: 422, error: "Already attached." };
  }
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  await addUserLink(db, libraryId, parsed.slug, hub);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: `Attached ${parsed.label}.`, group };
}

async function setVerseStar(
  db: D1Database,
  libraryId: string,
  hub: string,
  raw: unknown,
): Promise<VerseGroupActionResult> {
  const slug = canonSlug(typeof raw === "string" ? raw : "");
  if (!slug) return { ok: false, status: 422, error: "Need a passage." };
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const seen = await groupForHub(db, libraryId, hub);
  if (!seen) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  if (!seen.members.some((member) => member.slug === slug)) {
    return { ok: false, status: 422, error: "That verse is not in this group." };
  }
  await upsertStar(db, libraryId, hub, seen.star === slug ? "" : slug);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: "", group };
}

async function removeVerseMember(
  db: D1Database,
  libraryId: string,
  hub: string,
  raw: unknown,
): Promise<VerseGroupActionResult> {
  const slug = canonSlug(typeof raw === "string" ? raw : "");
  if (!slug) return { ok: false, status: 422, error: "Need a passage." };
  if (slug === hub) return { ok: false, status: 422, error: "That verse stays." };
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const before = await groupForHub(db, libraryId, hub);
  await removeUserLink(db, libraryId, slug, hub);
  await removeUserLink(db, libraryId, hub, slug);
  if (before && before.star === slug) await upsertStar(db, libraryId, hub, "");
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: "Removed.", group };
}

async function addVerseGroupLinks(
  db: D1Database,
  libraryId: string,
  hub: string,
): Promise<VerseGroupActionResult> {
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const before = await groupForHub(db, libraryId, hub);
  if (!before) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  const added: { from: string; to: string }[] = [];
  for (const pair of before.missingPairs) {
    const did = await addUserLink(db, libraryId, pair.from, pair.to);
    if (did) added.push({ from: pair.from, to: pair.to });
  }
  if (added.length) await setUndoPairs(db, libraryId, hub, added);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  const statusText =
    added.length === 0
      ? "No missing cross-links."
      : added.length === 1
        ? "Added 1 cross-link."
        : `Added ${added.length} cross-links.`;
  const more = before.missingCount > added.length ? " Some pairs are still missing." : "";
  return { ok: true, statusText: `${statusText}${more}`, group };
}

async function undoVerseGroupLinks(
  db: D1Database,
  libraryId: string,
  hub: string,
): Promise<VerseGroupActionResult> {
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const metas = await listVerseGroupMeta(db, libraryId);
  const meta = metas.find((row) => row.hub === hub);
  const pairs = meta?.undoPairs ?? [];
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  const members = new Set(group.members.map((member) => member.slug));
  let removed = 0;
  for (const pair of pairs) {
    if (!members.has(pair.from) || !members.has(pair.to)) continue;
    const did = await removeUserLink(db, libraryId, pair.from, pair.to);
    if (did) removed += 1;
  }
  await setUndoPairs(db, libraryId, hub, []);
  const next = await groupForHub(db, libraryId, hub);
  if (!next) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  const statusText = removed === 0 ? "Nothing to undo." : "Removed the cross-links from the last add.";
  return { ok: true, statusText, group: next };
}

/** Refuse a hub the library has not already formed. */
async function ensureHub(
  db: D1Database,
  libraryId: string,
  hub: string,
): Promise<{ ok: true } | { ok: false; status: 422; error: string }> {
  const notes = await listNotes(db, libraryId);
  const real = realVerseGroups(notes);
  if (real.some((group) => group.hub === hub)) return { ok: true };
  return { ok: false, status: 422, error: "That verse is not a hub yet." };
}

async function addUserLink(db: D1Database, libraryId: string, origin: string, target: string): Promise<boolean> {
  const existing = await findNote(db, libraryId, origin);
  const previous = existing?.attachments ?? [];
  const next = withManualXref(previous, target, newAttachmentId());
  if (!next.added) return false;
  if (!existing) {
    const draft = emptyNote(origin, next.list);
    if (!draft) return false;
    await saveNote(db, libraryId, draft);
  } else {
    await saveNote(db, libraryId, { ...existing, attachments: next.list });
  }
  await syncBidirectionalXrefs(db, libraryId, origin, previous, next.list);
  return true;
}

async function removeUserLink(db: D1Database, libraryId: string, origin: string, target: string): Promise<boolean> {
  const existing = await findNote(db, libraryId, origin);
  if (!existing) return false;
  const previous = existing.attachments;
  const next = withoutUserXref(previous, target);
  if (next.length === previous.length) return false;
  if (noteIsEmpty(existing.blocks, next, existing.bookmarked)) {
    await deleteNote(db, libraryId, origin);
    await syncBidirectionalXrefs(db, libraryId, origin, previous, []);
    return true;
  }
  await saveNote(db, libraryId, { ...existing, attachments: next });
  await syncBidirectionalXrefs(db, libraryId, origin, previous, next);
  return true;
}

async function groupForHub(db: D1Database, libraryId: string, hub: string): Promise<VerseGroupView | null> {
  const notes = await listNotes(db, libraryId);
  const metas = await listVerseGroupMeta(db, libraryId);
  return verseGroupsFromNotes(notes, metas).find((group) => group.hub === hub) ?? null;
}

async function addVerseGroupColumn(db: D1Database, column: string): Promise<void> {
  try {
    await db.prepare(`ALTER TABLE verse_groups ADD COLUMN ${column}`).run();
  } catch (err) {
    const message = err instanceof Error ? `${err.message} ${String(err.cause ?? "")}` : String(err);
    if (!/duplicate column/i.test(message)) throw err;
  }
}

export async function ensureVerseGroupsTable(db: D1Database): Promise<void> {
  await db.prepare(CREATE_VERSE_GROUPS).run();
  await addVerseGroupColumn(db, "star_slug TEXT NOT NULL DEFAULT ''");
  await addVerseGroupColumn(db, "jev_title TEXT NOT NULL DEFAULT ''");
}

/** Remember the title Jev wrote. A later save keeps this string so an edit can unlock, and matching text locks again. */
export async function saveJevTitle(db: D1Database, libraryId: string, hub: string, title: string): Promise<void> {
  await ensureVerseGroupsTable(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, jev_title, updated_at)
       VALUES (?, ?, ?, '', '[]', ?, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         title = excluded.title,
         jev_title = excluded.jev_title,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, title, title, now)
    .run();
}

export async function listVerseGroupMeta(db: D1Database, libraryId: string): Promise<VerseGroupMeta[]> {
  const result = await db
    .prepare("SELECT hub_slug, title, description, undo_json, star_slug, jev_title FROM verse_groups WHERE library_id = ?")
    .bind(libraryId)
    .all<MetaRow>();
  const metas: VerseGroupMeta[] = [];
  for (const row of result.results ?? []) {
    const hub = canonSlug(row.hub_slug);
    if (!hub) continue;
    metas.push({
      hub,
      title: row.title ?? "",
      description: row.description ?? "",
      undoPairs: parseUndoPairs(row.undo_json),
      star: row.star_slug ?? "",
      jevTitle: row.jev_title ?? "",
    });
  }
  return metas;
}

async function upsertVerseGroupText(
  db: D1Database,
  libraryId: string,
  hub: string,
  title: string,
  description: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, updated_at)
       VALUES (?, ?, ?, ?, '[]', ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, title, description, now)
    .run();
}

async function upsertStar(db: D1Database, libraryId: string, hub: string, star: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, star_slug, updated_at)
       VALUES (?, ?, '', '', '[]', ?, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         star_slug = excluded.star_slug,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, star, now)
    .run();
}

async function setUndoPairs(
  db: D1Database,
  libraryId: string,
  hub: string,
  pairs: { from: string; to: string }[],
): Promise<void> {
  const now = new Date().toISOString();
  const json = JSON.stringify(pairs.map((pair) => ({ from: pair.from, to: pair.to })));
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, updated_at)
       VALUES (?, ?, '', '', ?, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         undo_json = excluded.undo_json,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, json, now)
    .run();
}

function parseUndoPairs(raw: string | null): { from: string; to: string }[] {
  try {
    const data = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(data)) return [];
    const pairs: { from: string; to: string }[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const from = canonSlug(typeof record.from === "string" ? record.from : "");
      const to = canonSlug(typeof record.to === "string" ? record.to : "");
      if (!from || !to || from === to) continue;
      pairs.push({ from, to });
    }
    return pairs;
  } catch {
    return [];
  }
}

function emptyNote(slug: string, attachments: Attachment[]): NoteDraft | null {
  const passage = parsePassage(slug);
  if (!passage) return null;
  return {
    slug: passageSlug(passage),
    osis: passageOsis(passage),
    kind: passage.kind,
    book: passage.book,
    chapter: passage.chapter,
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
    blocks: [{ id: `b_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`, indent: 0, text: "", bullet: true }],
    bookmarked: false,
    attachments,
  };
}
