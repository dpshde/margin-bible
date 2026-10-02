import { newAttachmentId } from "./attachments";
import { deleteNote, findNote, saveNote, type NoteRecord } from "./library";
import { backlinkLoadSlugs, planXrefBacklinks, type BacklinkNote } from "./xref-backlinks";
import { slugLabel } from "./xref";

const syncing = new WeakMap<D1Database, Set<string>>();

export async function syncBidirectionalXrefs(
  db: D1Database,
  libraryId: string,
  origin: string,
  previous: NoteRecord["attachments"],
  next: NoteRecord["attachments"],
): Promise<string[]> {
  return applyBacklinks(db, libraryId, origin, previous, next, new Set());
}

/** Create missing mirrors for xrefs already stored on these notes. Does not remove any. */
export async function ensureBidirectionalXrefs(
  db: D1Database,
  libraryId: string,
  notes: NoteRecord[],
): Promise<string[]> {
  const linked: string[] = [];
  for (const note of notes) {
    const mirrors = note.attachments.filter((row) => row.kind === "xref" && row.source === "backlink");
    const created = await applyBacklinks(db, libraryId, note.slug, mirrors, note.attachments, new Set());
    linked.push(...created);
  }
  return linked;
}

async function applyBacklinks(
  db: D1Database,
  libraryId: string,
  origin: string,
  previous: NoteRecord["attachments"],
  next: NoteRecord["attachments"],
  stack: Set<string>,
): Promise<string[]> {
  const key = `${libraryId}:${origin}`;
  if (stack.has(key)) return [];
  stack.add(key);
  const guard = syncing.get(db) ?? new Set<string>();
  syncing.set(db, guard);
  if (guard.has(key)) return [];
  guard.add(key);

  try {
    const targets = backlinkLoadSlugs(origin, previous, next);
    const notes = new Map<string, BacklinkNote | null>();
    for (const slug of targets) {
      const found = await findNote(db, libraryId, slug);
      notes.set(slug, found ? snapshot(found) : null);
    }
    const ops = planXrefBacklinks({
      origin,
      previous,
      next,
      notes,
      label: slugLabel,
      ids: {
        attachment: newAttachmentId,
        block: () => `b_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
      },
    });
    const linked: string[] = [];
    for (const op of ops) {
      if (op.op === "delete") {
        const existing = await findNote(db, libraryId, op.slug);
        await deleteNote(db, libraryId, op.slug);
        linked.push(op.slug);
        if (existing) {
          const nested = await applyBacklinks(db, libraryId, existing.slug, existing.attachments, [], stack);
          linked.push(...nested);
        }
        continue;
      }
      await saveNote(db, libraryId, op.note);
      linked.push(op.note.slug);
    }
    return linked;
  } finally {
    guard.delete(key);
  }
}

function snapshot(note: NoteRecord): BacklinkNote {
  return {
    blocks: note.blocks,
    bookmarked: note.bookmarked,
    attachments: note.attachments,
  };
}
