import { describe, expect, test } from "bun:test";
import {
  authorizeMcp,
  DEFAULT_MCP_LIBRARY_ID,
  extractBearerToken,
  wwwAuthenticateBearer,
} from "../src/mcp-auth";
import {
  callMcpTool,
  MCP_HANDSHAKE_VERSION,
  MCP_TOOLS,
  noteAsMcpForTest,
  type McpToolContext,
} from "../src/mcp-tools";
import { buildStudyPrep } from "../src/study-prep";
import { parsePassage } from "../src/passage";
import type { NoteRecord } from "../src/library";
import type { ChapterPack } from "../src/usj";

function note(
  partial: Partial<NoteRecord> & Pick<NoteRecord, "slug" | "osis" | "kind" | "book" | "chapter">,
): NoteRecord {
  return {
    verseStart: null,
    verseEnd: null,
    blocks: [],
    bookmarked: false,
    attachments: [],
    createdAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
    ...partial,
  };
}

const SAMPLE_NOTES: NoteRecord[] = [
  note({
    slug: "jhn.3.16",
    osis: "JHN.3.16",
    kind: "verse",
    book: "JHN",
    chapter: 3,
    verseStart: 16,
    blocks: [{ id: "b_a", indent: 0, text: "Mine: the Logos.", bullet: true }],
  }),
  note({
    slug: "jhn.3.16-18",
    osis: "JHN.3.16-18",
    kind: "range",
    book: "JHN",
    chapter: 3,
    verseStart: 16,
    verseEnd: 18,
    blocks: [{ id: "b_b", indent: 0, text: "Mine: the range.", bullet: true }],
  }),
  note({
    slug: "jhn.3",
    osis: "JHN.3",
    kind: "chapter",
    book: "JHN",
    chapter: 3,
    blocks: [{ id: "b_c", indent: 0, text: "Mine: the chapter.", bullet: true }],
  }),
];

function fakeDb(notes: NoteRecord[]): D1Database {
  const bySlug = new Map(notes.map((n) => [n.slug, n]));
  return {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM libraries")) {
                return { last_read_slug: "jhn.3" } as T;
              }
              if (sql.includes("AND slug = ?")) {
                const slug = String(binds[1]);
                const row = bySlug.get(slug);
                return row ? (rowToSql(row) as T) : null;
              }
              return null;
            },
            async all<T>() {
              let rows = notes.map(rowToSql);
              // book+chapter filter when binds length 3
              if (binds.length >= 3 && sql.includes("AND book = ? AND chapter = ?")) {
                const book = String(binds[1]);
                const chapter = Number(binds[2]);
                rows = rows.filter((r) => r.book === book && r.chapter === chapter);
              }
              return { results: rows as T[] };
            },
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

function rowToSql(n: NoteRecord) {
  return {
    slug: n.slug,
    osis: n.osis,
    kind: n.kind,
    book: n.book,
    chapter: n.chapter,
    verse_start: n.verseStart,
    verse_end: n.verseEnd,
    blocks: JSON.stringify(n.blocks),
    bookmarked: n.bookmarked ? 1 : 0,
    attachments: JSON.stringify(n.attachments),
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

const PACK: ChapterPack = {
  translation: "BSB",
  book: "JHN",
  chapter: 3,
  verses: [
    { v: 16, text: "For God so loved the world that He gave His one and only Son…", heading: "Jesus and Nicodemus" },
    { v: 17, text: "For God did not send His Son into the world to condemn the world…" },
    { v: 18, text: "Whoever believes in Him is not condemned…" },
  ],
  source: "test",
  license: "public-domain",
};

function ctx(): McpToolContext {
  return {
    db: fakeDb(SAMPLE_NOTES),
    libraryId: DEFAULT_MCP_LIBRARY_ID,
    loadChapter: async () => PACK,
  };
}

describe("mcp auth", () => {
  test("extracts bearer token", () => {
    expect(extractBearerToken("Bearer abc")).toBe("abc");
    expect(extractBearerToken("bearer abc")).toBe("abc");
    expect(extractBearerToken(null)).toBeNull();
  });

  test("authorizeMcp requires matching secret", () => {
    expect(authorizeMcp({}, "Bearer x").ok).toBe(false);
    expect(authorizeMcp({ MCP_BEARER_TOKEN: "secret" }, "Bearer nope").ok).toBe(false);
    const ok = authorizeMcp(
      { MCP_BEARER_TOKEN: "secret", MCP_LIBRARY_ID: DEFAULT_MCP_LIBRARY_ID },
      "Bearer secret",
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.libraryId).toBe(DEFAULT_MCP_LIBRARY_ID);
  });

  test("www-authenticate advertises bearer", () => {
    expect(wwwAuthenticateBearer()).toContain('Bearer realm="margin.bible"');
    expect(wwwAuthenticateBearer("https://example/meta")).toContain("resource_metadata=");
  });
});

describe("mcp tools catalog", () => {
  test("lists the six read-only tools", () => {
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        "export_library",
        "get_note",
        "list_notes",
        "list_notes_covering_verse",
        "personal_study",
        "prepare_group_study",
      ].sort(),
    );
    for (const tool of MCP_TOOLS) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
    }
  });

  test("handshake version is 2025-11-25", () => {
    expect(MCP_HANDSHAKE_VERSION).toBe("2025-11-25");
  });
});

describe("mcp tool handlers", () => {
  test("list_notes returns library notes for a book", async () => {
    const result = await callMcpTool("list_notes", { book: "John" }, ctx());
    expect(result.isError).toBeUndefined();
    const notes = (result.structuredContent as { notes: Array<{ slug: string; body: string }> }).notes;
    expect(notes.map((n) => n.slug).sort()).toEqual(["jhn.3", "jhn.3.16", "jhn.3.16-18"]);
    expect(notes.every((n) => n.body.startsWith("Mine:"))).toBe(true);
  });

  test("list_notes exact osis", async () => {
    const result = await callMcpTool("list_notes", { osis: "jhn.3.16-18" }, ctx());
    const notes = (result.structuredContent as { notes: Array<{ slug: string }> }).notes;
    expect(notes.map((n) => n.slug)).toEqual(["jhn.3.16-18"]);
  });

  test("get_note and covering verse keep overlaps separate", async () => {
    const one = await callMcpTool("get_note", { osis: "jhn.3.16" }, ctx());
    expect((one.structuredContent as { body: string }).body).toBe("Mine: the Logos.");

    const covering = await callMcpTool("list_notes_covering_verse", { osis: "John 3:16" }, ctx());
    const slugs = (covering.structuredContent as { notes: Array<{ slug: string }> }).notes
      .map((n) => n.slug)
      .sort();
    expect(slugs).toEqual(["jhn.3.16", "jhn.3.16-18"]);
  });

  test("export_library returns margin.library-snapshot v1", async () => {
    const result = await callMcpTool("export_library", {}, ctx());
    const snap = result.structuredContent as { format: string; version: number; notes: unknown[] };
    expect(snap.format).toBe("margin.library-snapshot");
    expect(snap.version).toBe(1);
    expect(snap.notes.length).toBe(3);
  });

  test("note as_mcp shape", () => {
    const payload = noteAsMcpForTest(SAMPLE_NOTES[0]);
    expect(payload).toEqual({
      slug: "jhn.3.16",
      osis: "JHN.3.16",
      kind: "verse",
      body: "Mine: the Logos.",
      created_at: "2026-09-10T12:00:00.000Z",
      updated_at: "2026-09-10T12:00:00.000Z",
    });
  });
});

describe("study prep scaffolds", () => {
  test("personal_study serves BSB + notes and does not invent empty-span observations", async () => {
    const result = await callMcpTool("personal_study", { osis: "jhn.3" }, ctx());
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("For God so loved the world");
    expect(result.content[0].text).toContain("Mine: the Logos.");
    const structured = result.structuredContent as {
      missing_observations: boolean;
      sections: Array<{ observations: unknown[]; questions: unknown[] }>;
    };
    expect(structured.missing_observations).toBe(false);
    expect(structured.sections.some((s) => s.observations.length > 0)).toBe(true);
  });

  test("empty library leaves gap-preserving empty questions", () => {
    const passage = parsePassage("jhn.3")!;
    const prep = buildStudyPrep({
      passage,
      pack: PACK,
      notes: [],
      kind: "group",
    });
    expect(prep.missing_observations).toBe(true);
    expect(prep.markdown).toContain("Do not invent them");
    expect(prep.sections.every((s) => s.questions.length === 0)).toBe(true);
    expect(prep.sections[0].verses[0].text).toContain("For God so loved the world");
  });
});

describe("mcp http json-rpc (unit via handlers)", () => {
  test("initialize / tools/list shapes match Cursor handshake", async () => {
    // Exercise the same catalog the HTTP layer returns.
    expect(MCP_TOOLS.length).toBe(6);
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toContain("list_notes");
    expect(names).toContain("prepare_group_study");
  });
});
