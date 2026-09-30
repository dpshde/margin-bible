import { mergeParsedXrefs, normalizeAttachments, noteIsEmpty, type Attachment } from "./attachments";
import { passageOsis, passageSlug, type Passage } from "./passage";

export type Block = {
  id: string;
  indent: number;
  text: string;
  bullet: boolean;
};

export type NoteDraft = {
  slug: string;
  osis: string;
  kind: Passage["kind"];
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  blocks: Block[];
  bookmarked: boolean;
  attachments: Attachment[];
};

const BLOCK_ID = /^b[_-][A-Za-z0-9_-]{1,40}$/;
export const MAX_NOTE_CHARS = 20_000;

export function bodyText(blocks: Block[]): string {
  return blocks.map((block) => `${"  ".repeat(block.indent)}${block.text}`).join("\n");
}

export function emptyBlocks(blocks: Block[]): boolean {
  return blocks.every((block) => block.text.trim().length === 0);
}

export function noteCoversVerse(
  note: { kind: string; verseStart: number | null; verseEnd: number | null },
  verse: number,
): boolean {
  if (note.kind === "chapter" || note.verseStart == null) return false;
  const last = note.verseEnd ?? note.verseStart;
  return verse >= note.verseStart && verse <= last;
}

export function blocksFromText(text: string, ids: () => string): Block[] {
  const lines = text.length === 0 ? [""] : text.split("\n");
  const blocks = lines.map((line) => {
    const spaces = /^ */.exec(line)?.[0].length ?? 0;
    return {
      id: ids(),
      indent: Math.floor(spaces / 2),
      text: line.replace(/^ */, ""),
      bullet: true,
    };
  });
  return clampIndents(blocks);
}

export function blocksFromRows(rows: unknown, ids: () => string): Block[] | null {
  if (!Array.isArray(rows)) return null;
  const blocks = rows.map((row) => {
    if (!row || typeof row !== "object") {
      return { id: ids(), indent: 0, text: "", bullet: true };
    }
    const record = row as Record<string, unknown>;
    const rawId = typeof record.id === "string" && BLOCK_ID.test(record.id) ? record.id : ids();
    const indent = Number(record.indent);
    const bullet = record.bullet === undefined ? true : Boolean(record.bullet);
    return {
      id: rawId,
      indent: Number.isFinite(indent) ? indent : 0,
      text: typeof record.text === "string" ? record.text : "",
      bullet,
    };
  });
  if (blocks.length === 0) return clampIndents([{ id: ids(), indent: 0, text: "", bullet: true }]);
  return clampIndents(blocks);
}

export function draftNote(
  passage: Passage,
  input: {
    text?: string;
    blocks?: unknown;
    bookmarked?: boolean;
    attachments?: unknown;
    previousAttachments?: unknown;
  },
  ids: () => string,
): { ok: true; delete: boolean; note: NoteDraft } | { ok: false; error: string } {
  let blocks: Block[];
  if (input.blocks !== undefined) {
    const parsed = blocksFromRows(input.blocks, ids);
    if (!parsed) return { ok: false, error: "blocks must be a list" };
    blocks = parsed;
  } else if (typeof input.text === "string") {
    if (input.text.length > MAX_NOTE_CHARS) return { ok: false, error: "note is too long" };
    blocks = blocksFromText(input.text, ids);
  } else {
    return { ok: false, error: "text or blocks required" };
  }

  if (bodyText(blocks).length > MAX_NOTE_CHARS) return { ok: false, error: "note is too long" };

  const bookmarked = Boolean(input.bookmarked);
  const base =
    input.attachments !== undefined ? input.attachments : (input.previousAttachments ?? []);
  const incoming = normalizeAttachments(base);
  const previous = normalizeAttachments(input.previousAttachments ?? []);
  // Slugs present before this save but omitted from the client payload were dismissed via ×.
  const suppressScanSlugs =
    input.attachments !== undefined
      ? previous
          .filter((row) => row.kind === "xref")
          .filter((row) => !incoming.some((item) => item.kind === "xref" && item.slug === row.slug))
          .map((row) => row.slug)
      : [];
  const { list: attachments } = mergeParsedXrefs(incoming, blocks, { suppressScanSlugs });

  const note: NoteDraft = {
    slug: passageSlug(passage),
    osis: passageOsis(passage),
    kind: passage.kind,
    book: passage.book,
    chapter: passage.chapter,
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
    blocks,
    bookmarked,
    attachments,
  };
  return { ok: true, delete: noteIsEmpty(blocks, attachments, bookmarked), note };
}

function clampIndents(blocks: Block[]): Block[] {
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    block.indent = Math.min(32, Math.max(0, Math.trunc(block.indent)));
    if (i === 0) block.indent = 0;
    if (i > 0) block.indent = Math.min(block.indent, blocks[i - 1].indent + 1);
  }
  return blocks;
}

export function sequentialIds(prefix = "b_"): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}${n}`;
  };
}
