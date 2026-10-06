/**
 * Persist a web's name beside the hub slug. Xref sync keeps owning passage chips.
 * http(s) links live on this row as external refs, not as verse members.
 *
 * A hub has to already exist in the library. This store does not invent a sample mesh.
 * Pairwise cross-links are a separate confirm action.
 */
import { newAttachmentId, noteIsEmpty, type Attachment } from "./attachments";
import {
  deleteNote,
  deleteNoteStatement,
  findNote,
  libraryNotesStatement,
  listNotes,
  notesFromRows,
  putNoteStatement,
  saveNote,
  type NoteRecord,
} from "./library";
import { parsePassage, passageOsis, passageSlug } from "./passage";
import { backlinkLoadSlugs, planXrefBacklinks, type BacklinkNote } from "./xref-backlinks";
import { syncBidirectionalXrefs } from "./xref-sync";
import { slugLabel } from "./xref";
import {
  canonSlug,
  cleanGroupDescription,
  cleanGroupTitle,
  cleanRefTitle,
  NOT_A_VERSE_GROUP,
  realVerseGroups,
  verseGroupsFromNotes,
  groupAttachFromInput,
  normalizeExternalRefs,
  withExternalRef,
  withManualXref,
  withoutExternalRef,
  withoutUserXref,
  type GroupNote,
  type ExternalRef,
  type VerseGroupMeta,
  type VerseGroupView,
} from "./verse-groups";
import type { NoteDraft } from "./notes";

/** Schema DDL is once per database binding. The title backfill still runs every call. */
const verseGroupSchemaReady = new WeakMap<D1Database, Promise<void>>();

const CREATE_VERSE_GROUPS = `CREATE TABLE IF NOT EXISTS verse_groups (
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
)`;

type MetaRow = {
  hub_slug: string;
  title: string;
  description: string;
  undo_json: string | null;
  star_slug?: string | null;
  jev_title?: string | null;
  external_refs?: string | null;
  auto_titled?: number | null;
};

export type VerseGroupActionResult =
  | {
      ok: true;
      statusText: string;
      group: VerseGroupView;
      /** This action dropped the acted-on group under the link minimum. */
      dissolved?: boolean;
      /** A move dropped the group the chip left. */
      sourceDissolved?: boolean;
    }
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
    action !== "remove-external" &&
    action !== "retitle-external" &&
    action !== "move-member" &&
    action !== "set-star"
  ) {
    return { ok: false, status: 422, error: "unknown action" };
  }
  try {
    // Move and remove batch their own schema check, library read, and writes.
    if (action === "remove-member") return await removeVerseMember(db, libraryId, hub, record.slug);
    if (action === "move-member") return await moveVerseMember(db, libraryId, hub, record.from, record.slug);
    await ensureVerseGroupsTable(db);
    if (action === "save") {
      return await saveVerseGroup(db, libraryId, hub, {
        title: cleanGroupTitle(record.title),
        description: cleanGroupDescription(record.description),
      });
    }
    if (action === "add-member") return await addVerseMember(db, libraryId, hub, record.text);
    if (action === "remove-external") return await removeExternalRef(db, libraryId, hub, record.url);
    if (action === "retitle-external") return await retitleExternalRef(db, libraryId, hub, record.url, record.title);
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
  if (!group) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  return { ok: true, statusText: "Saved.", group };
}

async function addVerseMember(
  db: D1Database,
  libraryId: string,
  hub: string,
  raw: unknown,
): Promise<VerseGroupActionResult> {
  const parsed = groupAttachFromInput(raw);
  if (!parsed.ok) return { ok: false, status: 422, error: parsed.error };
  if (parsed.kind === "url") return addExternalRef(db, libraryId, hub, parsed.url, parsed.title);
  if (parsed.slug === hub) return { ok: false, status: 422, error: "Already attached." };
  const seen = await groupForHub(db, libraryId, hub);
  if (seen?.members.some((member) => member.slug === parsed.slug)) {
    return { ok: false, status: 422, error: "Already attached." };
  }
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  await addUserLink(db, libraryId, parsed.slug, hub);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  return { ok: true, statusText: `Attached ${parsed.label}.`, group };
}

async function addExternalRef(
  db: D1Database,
  libraryId: string,
  hub: string,
  url: string,
  title: string,
): Promise<VerseGroupActionResult> {
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const metas = await listVerseGroupMeta(db, libraryId);
  const current = metas.find((row) => row.hub === hub)?.externalRefs ?? [];
  const next = withExternalRef(current, { id: newAttachmentId(), url, title });
  if (!next.added) return { ok: false, status: 422, error: "Already attached." };
  await saveExternalRefs(db, libraryId, hub, next.list);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: `Attached ${next.added.title}.`, group };
}

async function retitleExternalRef(
  db: D1Database,
  libraryId: string,
  hub: string,
  rawUrl: unknown,
  rawTitle: unknown,
): Promise<VerseGroupActionResult> {
  const parsed = groupAttachFromInput(rawUrl);
  if (!parsed.ok || parsed.kind !== "url") return { ok: false, status: 422, error: "Need an http(s) link." };
  const title = cleanRefTitle(rawTitle, "");
  if (!title) return { ok: false, status: 422, error: "Need a title." };
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const metas = await listVerseGroupMeta(db, libraryId);
  const current = metas.find((row) => row.hub === hub)?.externalRefs ?? [];
  let found = false;
  let changed = false;
  const next = current.map((ref) => {
    if (ref.url !== parsed.url) return ref;
    found = true;
    if (ref.title === title) return ref;
    changed = true;
    return { ...ref, title };
  });
  if (!found) return { ok: false, status: 422, error: "That link is not in this group." };
  if (changed) await saveExternalRefs(db, libraryId, hub, next);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: "", group };
}

async function removeExternalRef(
  db: D1Database,
  libraryId: string,
  hub: string,
  raw: unknown,
): Promise<VerseGroupActionResult> {
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const metas = await listVerseGroupMeta(db, libraryId);
  const current = metas.find((row) => row.hub === hub)?.externalRefs ?? [];
  const next = withoutExternalRef(current, raw);
  if (!next.removed) return { ok: false, status: 422, error: "That link is not in this group." };
  await saveExternalRefs(db, libraryId, hub, next.list);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: "That verse is not a hub yet." };
  return { ok: true, statusText: "Removed.", group };
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
  if (!seen) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  if (!seen.members.some((member) => member.slug === slug)) {
    return { ok: false, status: 422, error: "That verse is not in this group." };
  }
  await upsertStar(db, libraryId, hub, seen.star === slug ? "" : slug);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  return { ok: true, statusText: "", group };
}

/**
 * Move a member onto another hub. One library read, then the xref edits and
 * their mirrors are planned in memory and written together.
 */
async function moveVerseMember(
  db: D1Database,
  libraryId: string,
  targetHub: string,
  fromRaw: unknown,
  slugRaw: unknown,
): Promise<VerseGroupActionResult> {
  const from = canonSlug(typeof fromRaw === "string" ? fromRaw : "");
  const slug = canonSlug(typeof slugRaw === "string" ? slugRaw : "");
  if (!from || !slug) return { ok: false, status: 422, error: "Need a passage." };
  if (from === targetHub) return { ok: false, status: 422, error: "Already in this group." };
  if (slug === targetHub) return { ok: false, status: 422, error: "Already attached." };

  const shelf = await loadMemberShelf(db, libraryId);
  const source = shelf.groups.find((group) => group.hub === from);
  const target = shelf.groups.find((group) => group.hub === targetHub);
  if (!source) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  if (!target) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  if (!source.members.some((member) => member.slug === slug)) {
    return { ok: false, status: 422, error: "That verse is not in this group." };
  }
  const already = target.members.some((member) => member.slug === slug);

  const writes: D1PreparedStatement[] = [];
  let metas = shelf.metas;
  if (slug !== from) {
    rewriteUserLink(shelf.notes, slug, from, "remove");
    rewriteUserLink(shelf.notes, from, slug, "remove");
    if (source.star === slug) {
      metas = metaWithStar(metas, from, "");
      writes.push(starStatement(db, libraryId, from, ""));
    }
  }
  if (!already) rewriteUserLink(shelf.notes, slug, targetHub, "add");
  await commitMemberShelf(db, libraryId, shelf, writes);

  const groups = verseGroupsFromNotes(liveNotes(shelf.notes), metas);
  const group = groups.find((row) => row.hub === targetHub);
  if (!group || !group.members.some((member) => member.slug === slug)) {
    return { ok: false, status: 422, error: "Could not move that verse." };
  }
  const sourceDissolved = slug !== from && !groups.some((row) => row.hub === from);
  return { ok: true, statusText: "Moved.", group, sourceDissolved };
}

/** Drop a member. Same single-read, batched-write path as a move. */
async function removeVerseMember(
  db: D1Database,
  libraryId: string,
  hub: string,
  raw: unknown,
): Promise<VerseGroupActionResult> {
  const slug = canonSlug(typeof raw === "string" ? raw : "");
  if (!slug) return { ok: false, status: 422, error: "Need a passage." };
  if (slug === hub) return { ok: false, status: 422, error: "That verse stays." };
  const shelf = await loadMemberShelf(db, libraryId);
  const before = shelf.groups.find((group) => group.hub === hub);
  if (!before) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };

  rewriteUserLink(shelf.notes, slug, hub, "remove");
  rewriteUserLink(shelf.notes, hub, slug, "remove");
  const writes: D1PreparedStatement[] = [];
  let metas = shelf.metas;
  if (before.star === slug) {
    metas = metaWithStar(metas, hub, "");
    writes.push(starStatement(db, libraryId, hub, ""));
  }
  await commitMemberShelf(db, libraryId, shelf, writes);

  const group = verseGroupsFromNotes(liveNotes(shelf.notes), metas).find((row) => row.hub === hub);
  if (!group) {
    // The link is gone. A web that falls under the minimum stays removed on screen.
    return {
      ok: true,
      statusText: "Removed.",
      dissolved: true,
      group: {
        ...before,
        members: before.members.filter((member) => member.slug !== slug),
        star: before.star === slug ? "" : before.star,
      },
    };
  }
  return { ok: true, statusText: "Removed.", group };
}

type MemberShelf = {
  original: Map<string, NoteRecord>;
  notes: Map<string, NoteRecord | null>;
  metas: VerseGroupMeta[];
  groups: VerseGroupView[];
};

async function loadMemberShelf(db: D1Database, libraryId: string): Promise<MemberShelf> {
  await ensureVerseGroupSchema(db);
  const [noteRows, metaRows] = await db.batch([
    libraryNotesStatement(db, libraryId),
    verseGroupMetaStatement(db, libraryId),
  ]);
  const notes = notesFromRows(noteRows.results as Parameters<typeof notesFromRows>[0]);
  const metas = metasFromRows(metaRows.results as MetaRow[]);
  const original = new Map(notes.map((note) => [note.slug, note]));
  const copy = new Map<string, NoteRecord | null>();
  for (const note of notes) copy.set(note.slug, { ...note, attachments: note.attachments.map((row) => ({ ...row })) });
  return { original, notes: copy, metas, groups: verseGroupsFromNotes(notes, metas) };
}

function liveNotes(notes: Map<string, NoteRecord | null>): NoteRecord[] {
  const live: NoteRecord[] = [];
  for (const note of notes.values()) if (note) live.push(note);
  return live;
}

function metaWithStar(metas: readonly VerseGroupMeta[], hub: string, star: string): VerseGroupMeta[] {
  let found = false;
  const next = metas.map((meta) => {
    if (meta.hub !== hub) return meta;
    found = true;
    return { ...meta, star };
  });
  if (!found) {
    next.push({ hub, title: "", description: "", undoPairs: [], star, jevTitle: "", autoTitled: false });
  }
  return next;
}

/** Edit one user xref and its mirror against the in-memory library. */
function rewriteUserLink(
  notes: Map<string, NoteRecord | null>,
  origin: string,
  target: string,
  mode: "add" | "remove",
): void {
  const existing = notes.get(origin) ?? null;
  const previous = existing?.attachments ?? [];
  const next =
    mode === "remove"
      ? withoutUserXref(previous, target)
      : withManualXref(previous, target, newAttachmentId()).list;
  if (attachmentJson(previous) === attachmentJson(next)) return;
  if (!existing) {
    const draft = emptyNote(origin, next);
    if (!draft) return;
    notes.set(origin, { ...draft, createdAt: "", updatedAt: "" });
  } else if (noteIsEmpty(existing.blocks, next, existing.bookmarked)) {
    notes.set(origin, null);
  } else {
    notes.set(origin, { ...existing, attachments: next });
  }
  applyBacklinkPlan(notes, origin, previous, next);
}

function applyBacklinkPlan(
  notes: Map<string, NoteRecord | null>,
  origin: string,
  previous: Attachment[],
  next: Attachment[],
): void {
  const loaded = new Map<string, BacklinkNote | null>();
  for (const slug of backlinkLoadSlugs(origin, previous, next)) {
    const note = notes.get(slug) ?? null;
    loaded.set(slug, note ? { blocks: note.blocks, bookmarked: note.bookmarked, attachments: note.attachments } : null);
  }
  const ops = planXrefBacklinks({
    origin,
    previous,
    next,
    notes: loaded,
    label: slugLabel,
    ids: {
      attachment: newAttachmentId,
      block: () => `b_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
    },
  });
  for (const op of ops) {
    if (op.op === "delete") {
      notes.set(op.slug, null);
      continue;
    }
    const prior = notes.get(op.note.slug) ?? null;
    notes.set(op.note.slug, {
      ...op.note,
      createdAt: prior?.createdAt ?? "",
      updatedAt: prior?.updatedAt ?? "",
    });
  }
}

/**
 * Title backfill plus every changed note (and an optional star write) in one
 * D1 batch. No read-after-write: the shelf already has the rows we just planned.
 */
async function commitMemberShelf(
  db: D1Database,
  libraryId: string,
  shelf: MemberShelf,
  extra: readonly D1PreparedStatement[],
): Promise<void> {
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [backfillAutoTitledStatement(db)];
  const slugs = new Set<string>([...shelf.original.keys(), ...shelf.notes.keys()]);
  for (const slug of slugs) {
    const prev = shelf.original.get(slug) ?? null;
    const next = shelf.notes.has(slug) ? (shelf.notes.get(slug) ?? null) : prev;
    if (!next) {
      if (prev) statements.push(deleteNoteStatement(db, libraryId, slug));
      continue;
    }
    if (!prev || attachmentJson(prev.attachments) !== attachmentJson(next.attachments)) {
      statements.push(putNoteStatement(db, libraryId, next, now));
    }
  }
  statements.push(...extra);
  await db.batch(statements);
}

function attachmentJson(list: readonly Attachment[] | null | undefined): string {
  return JSON.stringify(list ?? []);
}

async function addVerseGroupLinks(
  db: D1Database,
  libraryId: string,
  hub: string,
): Promise<VerseGroupActionResult> {
  const ready = await ensureHub(db, libraryId, hub);
  if (!ready.ok) return ready;
  const before = await groupForHub(db, libraryId, hub);
  if (!before) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  const added: { from: string; to: string }[] = [];
  for (const pair of before.missingPairs) {
    const did = await addUserLink(db, libraryId, pair.from, pair.to);
    if (did) added.push({ from: pair.from, to: pair.to });
  }
  if (added.length) await setUndoPairs(db, libraryId, hub, added);
  const group = await groupForHub(db, libraryId, hub);
  if (!group) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
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
  if (!group) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
  const members = new Set(group.members.map((member) => member.slug));
  let removed = 0;
  for (const pair of pairs) {
    if (!members.has(pair.from) || !members.has(pair.to)) continue;
    const did = await removeUserLink(db, libraryId, pair.from, pair.to);
    if (did) removed += 1;
  }
  await setUndoPairs(db, libraryId, hub, []);
  const next = await groupForHub(db, libraryId, hub);
  if (!next) return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
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
  return { ok: false, status: 422, error: NOT_A_VERSE_GROUP };
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

async function ensureVerseGroupSchema(db: D1Database): Promise<void> {
  let pending = verseGroupSchemaReady.get(db);
  if (!pending) {
    pending = migrateVerseGroupSchema(db).catch((err) => {
      verseGroupSchemaReady.delete(db);
      throw err;
    });
    verseGroupSchemaReady.set(db, pending);
  }
  await pending;
}

export async function ensureVerseGroupsTable(db: D1Database): Promise<void> {
  await ensureVerseGroupSchema(db);
  await backfillAutoTitled(db);
}

async function migrateVerseGroupSchema(db: D1Database): Promise<void> {
  await db.prepare(CREATE_VERSE_GROUPS).run();
  await addVerseGroupColumn(db, "star_slug TEXT NOT NULL DEFAULT ''");
  await addVerseGroupColumn(db, "jev_title TEXT NOT NULL DEFAULT ''");
  await addVerseGroupColumn(db, "external_refs TEXT NOT NULL DEFAULT '[]'");
  await addVerseGroupColumn(db, "auto_titled INTEGER NOT NULL DEFAULT 0");
}

/**
 * Groups that already have a title were named by hand or by the old sparkle.
 * Flag them so the one-shot pass does not overwrite them. Idempotent.
 */
function backfillAutoTitledStatement(db: D1Database): D1PreparedStatement {
  return db.prepare("UPDATE verse_groups SET auto_titled = 1 WHERE auto_titled = 0 AND trim(title) != ''");
}

async function backfillAutoTitled(db: D1Database): Promise<void> {
  await backfillAutoTitledStatement(db).run();
}

/** Set the lock without changing the title. A later edit does not clear it. */
export async function markVerseGroupAutoTitled(db: D1Database, libraryId: string, hub: string): Promise<void> {
  await ensureVerseGroupsTable(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, auto_titled, updated_at)
       VALUES (?, ?, '', '', '[]', 1, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         auto_titled = 1,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, now)
    .run();
}

/**
 * Keep a title the reader already typed. Does not record it as Jev's title.
 * Returns false when a title or the lock landed first.
 */
export async function claimOpenTitle(db: D1Database, libraryId: string, hub: string, title: string): Promise<boolean> {
  await ensureVerseGroupsTable(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, auto_titled, updated_at)
       VALUES (?, ?, ?, '', '[]', 1, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         title = excluded.title,
         auto_titled = 1,
         updated_at = excluded.updated_at
       WHERE verse_groups.auto_titled = 0 AND trim(verse_groups.title) = ''`,
    )
    .bind(libraryId, hub, title, now)
    .run();
  const row = await db
    .prepare("SELECT title, auto_titled FROM verse_groups WHERE library_id = ? AND hub_slug = ?")
    .bind(libraryId, hub)
    .first<{ title: string; auto_titled: number | null }>();
  return Boolean(row && Number(row.auto_titled) === 1 && (row.title ?? "") === title);
}

/**
 * Write Jev's title only while the group is still unlocked and untitled.
 * Returns false when a title or the lock landed first.
 */
export async function saveAutoTitle(db: D1Database, libraryId: string, hub: string, title: string): Promise<boolean> {
  await ensureVerseGroupsTable(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, jev_title, auto_titled, updated_at)
       VALUES (?, ?, ?, '', '[]', ?, 1, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         title = excluded.title,
         jev_title = excluded.jev_title,
         auto_titled = 1,
         updated_at = excluded.updated_at
       WHERE verse_groups.auto_titled = 0 AND trim(verse_groups.title) = ''`,
    )
    .bind(libraryId, hub, title, title, now)
    .run();
  const row = await db
    .prepare("SELECT title, auto_titled FROM verse_groups WHERE library_id = ? AND hub_slug = ?")
    .bind(libraryId, hub)
    .first<{ title: string; auto_titled: number | null }>();
  return Boolean(row && Number(row.auto_titled) === 1 && (row.title ?? "") === title);
}

function verseGroupMetaStatement(db: D1Database, libraryId: string): D1PreparedStatement {
  return db
    .prepare(
      "SELECT hub_slug, title, description, undo_json, star_slug, jev_title, auto_titled, external_refs FROM verse_groups WHERE library_id = ?",
    )
    .bind(libraryId);
}

function metasFromRows(rows: readonly MetaRow[] | null | undefined): VerseGroupMeta[] {
  const metas: VerseGroupMeta[] = [];
  for (const row of rows ?? []) {
    const hub = canonSlug(row.hub_slug);
    if (!hub) continue;
    metas.push({
      hub,
      title: row.title ?? "",
      description: row.description ?? "",
      undoPairs: parseUndoPairs(row.undo_json),
      star: row.star_slug ?? "",
      jevTitle: row.jev_title ?? "",
      externalRefs: parseExternalRefs(row.external_refs),
      autoTitled: Number(row.auto_titled) === 1,
    });
  }
  return metas;
}

export async function listVerseGroupMeta(db: D1Database, libraryId: string): Promise<VerseGroupMeta[]> {
  const result = await verseGroupMetaStatement(db, libraryId).all<MetaRow>();
  return metasFromRows(result.results);
}

async function upsertVerseGroupText(
  db: D1Database,
  libraryId: string,
  hub: string,
  title: string,
  description: string,
): Promise<void> {
  const now = new Date().toISOString();
  const locked = title.trim() ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, auto_titled, updated_at)
       VALUES (?, ?, ?, ?, '[]', ?, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         auto_titled = CASE
           WHEN trim(excluded.title) != '' THEN 1
           ELSE verse_groups.auto_titled
         END,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, title, description, locked, now)
    .run();
}

function starStatement(db: D1Database, libraryId: string, hub: string, star: string): D1PreparedStatement {
  const now = new Date().toISOString();
  return db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, star_slug, updated_at)
       VALUES (?, ?, '', '', '[]', ?, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         star_slug = excluded.star_slug,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, star, now);
}

async function upsertStar(db: D1Database, libraryId: string, hub: string, star: string): Promise<void> {
  await starStatement(db, libraryId, hub, star).run();
}

async function saveExternalRefs(
  db: D1Database,
  libraryId: string,
  hub: string,
  refs: readonly ExternalRef[],
): Promise<void> {
  const now = new Date().toISOString();
  const json = JSON.stringify(normalizeExternalRefs(refs));
  await db
    .prepare(
      `INSERT INTO verse_groups (library_id, hub_slug, title, description, undo_json, external_refs, updated_at)
       VALUES (?, ?, '', '', '[]', ?, ?)
       ON CONFLICT(library_id, hub_slug) DO UPDATE SET
         external_refs = excluded.external_refs,
         updated_at = excluded.updated_at`,
    )
    .bind(libraryId, hub, json, now)
    .run();
}

function parseExternalRefs(raw: string | null | undefined): ExternalRef[] {
  try {
    return normalizeExternalRefs(JSON.parse(raw || "[]") as unknown);
  } catch {
    return [];
  }
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
