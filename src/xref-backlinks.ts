import type { Attachment } from "./attachments";
import type { Block, NoteDraft } from "./notes";

/**
 * A user xref is a manual chip or a ref scanned from the note text.
 * A backlink is the mirror Margin writes on the other passage.
 * One chip per slug, so a passage either owns the link or displays the mirror.
 */
export type BacklinkNote = {
  blocks: Block[];
  bookmarked: boolean;
  attachments: Attachment[];
};

export type BacklinkOp =
  | { op: "save"; note: NoteDraft }
  | { op: "delete"; slug: string };

const SLUG = /^([1-3]?[a-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i;

export function planXrefBacklinks(input: {
  origin: string;
  previous: Attachment[];
  next: Attachment[];
  notes: ReadonlyMap<string, BacklinkNote | null>;
  label: (slug: string) => string;
  ids: { attachment: () => string; block: () => string };
}): BacklinkOp[] {
  const origin = canonSlug(input.origin);
  if (!origin) return [];

  const initial = new Map<string, BacklinkNote | null>();
  for (const [slug, note] of input.notes) {
    const key = canonSlug(slug);
    if (key) initial.set(key, note);
  }
  const slots = new Map(initial);
  const dirty = new Set<string>();

  const remember = (slug: string, note: BacklinkNote | null) => {
    slots.set(slug, note);
    dirty.add(slug);
  };

  for (const target of removedSlugs(userSlugs(input.previous), userSlugs(input.next))) {
    if (target === origin) continue;
    const note = slots.get(target) ?? null;
    if (!note) continue;
    const attachments = dropXref(note.attachments, origin, "backlink");
    if (attachments.length === note.attachments.length) continue;
    remember(target, blankNote(note, attachments) ? null : { ...note, attachments });
  }

  for (const target of removedSlugs(backlinkSlugs(input.previous), backlinkSlugs(input.next))) {
    if (target === origin) continue;
    const note = slots.get(target) ?? null;
    if (!note) continue;
    const attachments = dropXref(note.attachments, origin, "user");
    if (attachments.length === note.attachments.length) continue;
    remember(target, blankNote(note, attachments) ? null : { ...note, attachments });
  }

  for (const target of userSlugs(input.next)) {
    if (target === origin) continue;
    const note = slots.get(target) ?? null;
    if (note?.attachments.some((row) => row.kind === "xref" && canonSlug(row.slug) === origin)) continue;
    const backlink: Attachment = {
      id: input.ids.attachment(),
      kind: "xref",
      slug: origin,
      title: input.label(origin),
      source: "backlink",
    };
    const attachments = [...(note?.attachments ?? []), backlink];
    if (note) remember(target, { ...note, attachments });
    else {
      remember(target, {
        blocks: [{ id: input.ids.block(), indent: 0, text: "", bullet: true }],
        bookmarked: false,
        attachments,
      });
    }
  }

  const ops: BacklinkOp[] = [];
  for (const slug of dirty) {
    if (slug === origin) continue;
    const before = initial.get(slug) ?? null;
    const after = slots.get(slug) ?? null;
    if (!after) {
      if (before) ops.push({ op: "delete", slug });
      continue;
    }
    const draft = toDraft(slug, after);
    if (!draft) continue;
    if (before && sameNote(before, after)) continue;
    ops.push({ op: "save", note: draft });
  }
  return ops;
}

export function backlinkLoadSlugs(origin: string, previous: Attachment[], next: Attachment[]): string[] {
  const self = canonSlug(origin);
  const slugs = new Set<string>();
  for (const slug of [
    ...userSlugs(next),
    ...removedSlugs(userSlugs(previous), userSlugs(next)),
    ...removedSlugs(backlinkSlugs(previous), backlinkSlugs(next)),
  ]) {
    if (slug && slug !== self) slugs.add(slug);
  }
  return [...slugs];
}

function userSlugs(list: Attachment[]): string[] {
  const slugs: string[] = [];
  for (const row of list) {
    if (row.kind !== "xref" || row.source === "backlink") continue;
    const slug = canonSlug(row.slug);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

function backlinkSlugs(list: Attachment[]): string[] {
  const slugs: string[] = [];
  for (const row of list) {
    if (row.kind !== "xref" || row.source !== "backlink") continue;
    const slug = canonSlug(row.slug);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

function removedSlugs(previous: string[], next: string[]): string[] {
  const keep = new Set(next);
  return previous.filter((slug) => !keep.has(slug));
}

function dropXref(list: Attachment[], slug: string, which: "backlink" | "user"): Attachment[] {
  return list.filter((row) => {
    if (row.kind !== "xref" || canonSlug(row.slug) !== slug) return true;
    return which === "backlink" ? row.source !== "backlink" : row.source === "backlink";
  });
}

function blankNote(note: BacklinkNote, attachments: Attachment[]): boolean {
  if (note.bookmarked) return false;
  const noText = note.blocks.every((block) => block.text.trim().length === 0);
  return noText && attachments.length === 0;
}

function sameNote(left: BacklinkNote, right: BacklinkNote): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toDraft(slug: string, note: BacklinkNote): NoteDraft | null {
  const shell = passageFromSlug(slug);
  if (!shell) return null;
  return { ...shell, ...note };
}

function canonSlug(slug: string): string | null {
  return passageFromSlug(slug)?.slug ?? null;
}

function passageFromSlug(slug: string): Omit<NoteDraft, "blocks" | "bookmarked" | "attachments"> | null {
  const match = SLUG.exec(String(slug || "").trim());
  if (!match) return null;
  const book = match[1].toLowerCase();
  const chapter = Number(match[2]);
  const verseStart = match[3] ? Number(match[3]) : null;
  const verseEndRaw = match[4] ? Number(match[4]) : null;
  const kind =
    verseStart == null ? "chapter" : verseEndRaw != null && verseEndRaw !== verseStart ? "range" : "verse";
  const canonical =
    kind === "chapter"
      ? `${book}.${chapter}`
      : kind === "range"
        ? `${book}.${chapter}.${verseStart}-${verseEndRaw}`
        : `${book}.${chapter}.${verseStart}`;
  return {
    slug: canonical,
    osis: canonical.toUpperCase(),
    kind,
    book: book.toUpperCase(),
    chapter,
    verseStart: kind === "chapter" ? null : verseStart,
    verseEnd: kind === "range" ? verseEndRaw : null,
  };
}
