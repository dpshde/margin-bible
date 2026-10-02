/** Read-only MCP tool definitions + handlers (Rails Margin::Mcp parity). */

import { resolveAlias } from "./books";
import { findNote, listNotes, noteJson, type NoteRecord } from "./library";
import { buildLibrarySnapshot } from "./library-snapshot";
import { bodyText, noteCoversVerse } from "./notes";
import { parsePassage, passageSlug } from "./passage";
import { buildStudyPrep, type StudyKind } from "./study-prep";
import type { ChapterPack } from "./usj";

export const MCP_SERVER_NAME = "margin.bible";
export const MCP_SERVER_VERSION = "1.0.0";
export const MCP_HANDSHAKE_VERSION = "2025-11-25";
export const MCP_INSTRUCTIONS =
  "Read notes from the library the user authorized. " +
  "Overlapping notes stay separate — a verse note and a range note that covers it are two records. " +
  "export_library returns the same read-only margin.library-snapshot v1 JSON as GET /export. " +
  "There are two study tools. personal_study is when the reader wants to dive deeper themselves " +
  "(learn, understand). prepare_group_study is when they are writing questions for a small group. " +
  "If they say 'study this' without saying which, ask before calling a tool. " +
  "Study questions should leave a gap rather than name the point. Leader notes are considered, not recited. " +
  "Study tools return BSB text alongside notes and questions. Never invent observations or write tools.";

export type McpToolContent = { type: "text"; text: string };

export type McpToolResult = {
  content: McpToolContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "list_notes",
    description:
      "List notes in the authorized library. Filter by book, chapter, exact OSIS/slug, or a text query. Overlapping notes stay separate.",
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "string", description: "Book name or OSIS code, e.g. John or JHN" },
        chapter: { type: "integer", description: "Chapter number" },
        osis: { type: "string", description: "Exact note address, e.g. jhn.3.16 or JHN.3.16-18" },
        query: { type: "string", description: "Case-insensitive substring match on note body" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "get_note",
    description: "Get one note from the authorized library by OSIS or slug. Does not merge overlapping notes.",
    inputSchema: {
      type: "object",
      properties: {
        osis: { type: "string", description: "Note address, e.g. jhn.3.16 or John 3:16" },
      },
      required: ["osis"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "list_notes_covering_verse",
    description:
      "List every note whose span covers a verse (exact verse notes and overlapping range notes). Chapter notes never cover a verse. Records stay separate — compose, don't absorb.",
    inputSchema: {
      type: "object",
      properties: {
        osis: { type: "string", description: "A verse address, e.g. jhn.3.16 or John 3:16" },
      },
      required: ["osis"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "export_library",
    description:
      "Return a read-only JSON snapshot of the authorized library (margin.library-snapshot v1). Same shape as GET /export: last-read slug, read trail, and every note. Does not write or invent credentials.",
    inputSchema: { type: "object", properties: {} },
    annotations: READ_ONLY,
  },
  {
    name: "personal_study",
    description:
      "Personal Bible study: help the reader go deeper in their own notes — learn and understand. Not for writing small-group discussion questions (use prepare_group_study for that). If it is unclear whether they want personal study or group prep, ask before calling this tool. Serves BSB verse text next to their outliner notes, grouped into 3–4 sections, and presses: what is still cloudy, where Scripture traces the same thing, how they might be misreading. Leave a gap; don't name the point. Never invent observations for verses they have not annotated.",
    inputSchema: {
      type: "object",
      properties: {
        osis: { type: "string", description: "Chapter or range, e.g. jhn.4 or John 4" },
        notes: {
          type: "string",
          description:
            "Optional extra observations in the reader's own words. Library notes are included automatically.",
        },
      },
      required: ["osis"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "prepare_group_study",
    description:
      "Small-group Bible study prep. Consider the leader's notes when drafting Kruger-shaped questions (warm-up, Google map, Houston, Achilles heel). Don't treat those notes as the answer the group must recite. Don't preach the landing in the question — leave a gap. Not for the leader's own private learning (use personal_study for that). If it is unclear whether they want personal study or group prep, ask before calling this tool. Serves BSB verse text next to the leader's outliner notes and Kruger-shaped questions. Never invent observations for verses they have not annotated. Empty question spans stay empty.",
    inputSchema: {
      type: "object",
      properties: {
        osis: {
          type: "string",
          description: "Chapter or range, e.g. jhn.4 or John 4 or 1jn.4.1-21",
        },
        notes: {
          type: "string",
          description:
            "Optional extra observations (the leader's words only). Library notes for the passage are included automatically.",
        },
      },
      required: ["osis"],
    },
    annotations: READ_ONLY,
  },
];

export type McpToolContext = {
  db: D1Database;
  libraryId: string;
  loadChapter: (book: string, chapter: number) => Promise<ChapterPack | null>;
};

export async function callMcpTool(
  name: string,
  args: Record<string, unknown> | undefined,
  ctx: McpToolContext,
): Promise<McpToolResult> {
  const a = args ?? {};
  switch (name) {
    case "list_notes":
      return listNotesTool(ctx, a);
    case "get_note":
      return getNoteTool(ctx, a);
    case "list_notes_covering_verse":
      return coveringVerseTool(ctx, a);
    case "export_library":
      return exportLibraryTool(ctx);
    case "personal_study":
      return studyTool(ctx, a, "personal");
    case "prepare_group_study":
      return studyTool(ctx, a, "group");
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

function noteAsMcp(note: NoteRecord) {
  return {
    slug: note.slug,
    osis: note.osis,
    kind: note.kind,
    body: bodyText(note.blocks),
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

async function listNotesTool(ctx: McpToolContext, args: Record<string, unknown>): Promise<McpToolResult> {
  const osis = typeof args.osis === "string" ? args.osis : null;
  const bookRaw = typeof args.book === "string" ? args.book : null;
  const chapterRaw =
    typeof args.chapter === "number"
      ? args.chapter
      : typeof args.chapter === "string" && args.chapter.trim()
        ? Number(args.chapter)
        : null;
  const chapter = chapterRaw != null && Number.isFinite(chapterRaw) ? Number(chapterRaw) : null;
  const query = typeof args.query === "string" ? args.query : null;
  const book = bookRaw ? resolveAlias(bookRaw) || bookRaw.toUpperCase() : null;

  let notes: NoteRecord[];
  if (osis) {
    const passage = parsePassage(osis);
    if (!passage) {
      notes = [];
    } else {
      const one = await findNote(ctx.db, ctx.libraryId, passageSlug(passage));
      notes = one ? [one] : [];
    }
  } else if (book && chapter != null) {
    notes = await listNotes(ctx.db, ctx.libraryId, { book, chapter });
  } else {
    notes = await listNotes(ctx.db, ctx.libraryId);
    if (book) notes = notes.filter((n) => n.book === book);
    if (chapter != null) notes = notes.filter((n) => n.chapter === chapter);
  }

  if (query) {
    const needle = query.toLowerCase();
    notes = notes.filter((n) => bodyText(n.blocks).toLowerCase().includes(needle));
  }

  const payload = notes.map(noteAsMcp);
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: { notes: payload },
  };
}

async function getNoteTool(ctx: McpToolContext, args: Record<string, unknown>): Promise<McpToolResult> {
  const osis = typeof args.osis === "string" ? args.osis : "";
  const passage = parsePassage(osis);
  const note = passage ? await findNote(ctx.db, ctx.libraryId, passageSlug(passage)) : null;
  if (!note) {
    return {
      content: [{ type: "text", text: `No note at ${osis} in this library.` }],
      isError: true,
    };
  }
  const payload = noteAsMcp(note);
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

async function coveringVerseTool(
  ctx: McpToolContext,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const osis = typeof args.osis === "string" ? args.osis : "";
  const passage = parsePassage(osis);
  if (!passage?.verseStart) {
    return {
      content: [{ type: "text", text: JSON.stringify([], null, 2) }],
      structuredContent: { notes: [] },
    };
  }
  const chapterNotes = await listNotes(ctx.db, ctx.libraryId, {
    book: passage.book,
    chapter: passage.chapter,
  });
  const notes = chapterNotes.filter((n) => noteCoversVerse(n, passage.verseStart!));
  const payload = notes.map(noteAsMcp);
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: { notes: payload },
  };
}

async function exportLibraryTool(ctx: McpToolContext): Promise<McpToolResult> {
  const [library, notes] = await Promise.all([
    ctx.db
      .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
      .bind(ctx.libraryId)
      .first<{ last_read_slug: string | null }>(),
    listNotes(ctx.db, ctx.libraryId),
  ]);
  const payload = buildLibrarySnapshot({
    lastReadSlug: library?.last_read_slug ?? null,
    readTrail: [],
    notes,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

async function studyTool(
  ctx: McpToolContext,
  args: Record<string, unknown>,
  kind: StudyKind,
): Promise<McpToolResult> {
  const osis = typeof args.osis === "string" ? args.osis : "";
  const extra = typeof args.notes === "string" ? args.notes : null;
  const passage = parsePassage(osis);
  if (!passage) {
    return {
      content: [{ type: "text", text: `Couldn’t resolve ${JSON.stringify(osis)} to a passage.` }],
      isError: true,
    };
  }
  const [notes, pack] = await Promise.all([
    listNotes(ctx.db, ctx.libraryId, { book: passage.book, chapter: passage.chapter }),
    ctx.loadChapter(passage.book, passage.chapter),
  ]);
  const payload = buildStudyPrep({ passage, pack, notes, extraNotes: extra, kind });
  return {
    content: [{ type: "text", text: payload.markdown }],
    structuredContent: payload,
  };
}

/** Exported for tests that inspect note JSON shape without D1. */
export function noteAsMcpForTest(note: NoteRecord) {
  return noteAsMcp(note);
}

export { noteJson };
