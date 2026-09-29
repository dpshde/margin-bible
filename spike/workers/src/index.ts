import { Hono, type Context } from "hono";
import {
  deleteNote,
  ensureLibrary,
  libraryCookie,
  listNotes,
  noteJson,
  readLibraryCookie,
  rememberRead,
  saveNote,
  type NoteRecord,
} from "./library";
import { draftNote } from "./notes";
import { parsePassage, passageLabel, passageSlug, type Passage } from "./passage";
import { renderChapterPage, renderMissing, renderNotesIndex } from "./reader-page";
import type { ChapterPack } from "./usj";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

type Variables = {
  libraryId: string;
  freshLibrary: boolean;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  if (c.req.path === "/health" || c.req.path.startsWith("/bsb/")) {
    await next();
    return;
  }
  const cookieId = readLibraryCookie(c.req.header("Cookie") ?? null);
  const library = await ensureLibrary(c.env.DB, cookieId);
  c.set("libraryId", library.id);
  c.set("freshLibrary", library.fresh || cookieId !== library.id);
  if (c.get("freshLibrary")) {
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", libraryCookie(library.id, secure));
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true, spike: "workers-d1" }));

app.get("/bsb/*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.get("/", async (c) => {
  const library = await c.env.DB
    .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
    .bind(c.get("libraryId"))
    .first<{ last_read_slug: string | null }>();
  const slug = library?.last_read_slug || "jhn.1";
  return c.redirect(`/${slug}`, 302);
});

app.get("/jump", (c) => {
  const passage = parsePassage(c.req.query("q"));
  if (!passage) return c.html(renderMissing("Couldn’t resolve that passage. Try John 3:16 or jhn.3.16."), 422);
  return c.redirect(`/${passageSlug(passage)}`, 302);
});

app.get("/notes", async (c) => {
  const library = await c.env.DB
    .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
    .bind(c.get("libraryId"))
    .first<{ last_read_slug: string | null }>();
  const notes = await listNotes(c.env.DB, c.get("libraryId"));
  return c.html(renderNotesIndex(notes, safeBack(library?.last_read_slug || "jhn.1")));
});

app.get("/api/notes", async (c) => {
  const queried = await notesForQuery(c.env.DB, c.get("libraryId"), c.req.query("chapter"), c.req.query("verse"));
  if (!queried.ok) return c.json({ ok: false, error: queried.error }, 422);
  return c.json({ ok: true, notes: queried.notes.map(noteJson) });
});

app.put("/api/notes/:slug", (c) => upsert(c, false));
app.post("/api/notes/:slug", (c) => upsert(c, true));

app.get("/:slug", async (c) => {
  const passage = parsePassage(c.req.param("slug"));
  if (!passage) return c.html(renderMissing("Couldn’t resolve that passage."), 404);
  const pack = await loadChapter(c.env.ASSETS, passage);
  if (!pack) return c.html(renderMissing(`No BSB chapter for ${passageLabel(passage)}.`), 404);
  await rememberRead(c.env.DB, c.get("libraryId"), passageSlug(passage));
  const notes = await listNotes(c.env.DB, c.get("libraryId"), { book: passage.book, chapter: passage.chapter });
  return c.html(renderChapterPage({ passage, pack, notes }), 200, { "cache-control": "private, no-store" });
});

async function upsert(c: AppContext, formPost: boolean): Promise<Response> {
  const passage = parsePassage(c.req.param("slug"));
  if (!passage) return fail(c, formPost, 422, "unresolvable");
  const input = await readNoteInput(c);
  if ("error" in input && input.error) return fail(c, formPost, 422, input.error);
  const ids = () => `b_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const draft = draftNote(passage, input, ids);
  if (!draft.ok) return fail(c, formPost, 422, draft.error);

  const libraryId = c.get("libraryId");
  let deleted = false;
  let note: NoteRecord | null = null;
  if (draft.delete) {
    await deleteNote(c.env.DB, libraryId, draft.note.slug);
    deleted = true;
  } else {
    note = await saveNote(c.env.DB, libraryId, draft.note);
  }

  if (formPost) return c.redirect(`/${draft.note.slug}`, 303);
  const chapterNotes = await listNotes(c.env.DB, libraryId, { book: passage.book, chapter: passage.chapter });
  return c.json({
    ok: true,
    deleted,
    slug: draft.note.slug,
    note: note ? noteJson(note) : null,
    chapterNotes: chapterNotes.map(noteJson),
  });
}

async function readNoteInput(c: AppContext): Promise<{ text?: string; blocks?: unknown; error?: string }> {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return { error: "invalid json" };
    const record = body as Record<string, unknown>;
    return {
      text: typeof record.text === "string" ? record.text : undefined,
      blocks: record.blocks,
    };
  }
  const form = await c.req.parseBody();
  const text = form.text;
  return { text: typeof text === "string" ? text : "" };
}

async function notesForQuery(
  db: D1Database,
  libraryId: string,
  chapter: string | undefined,
  verse: string | undefined,
): Promise<{ ok: true; notes: NoteRecord[] } | { ok: false; error: string }> {
  if (verse) {
    const passage = parsePassage(verse);
    if (!passage?.verseStart) return { ok: false, error: "verse required" };
    const notes = await listNotes(db, libraryId, {
      book: passage.book,
      chapter: passage.chapter,
      verse: passage.verseStart,
    });
    return { ok: true, notes };
  }
  if (chapter) {
    const passage = parsePassage(chapter);
    if (!passage) return { ok: false, error: "unresolvable" };
    const notes = await listNotes(db, libraryId, { book: passage.book, chapter: passage.chapter });
    return { ok: true, notes };
  }
  return { ok: true, notes: await listNotes(db, libraryId) };
}

async function loadChapter(assets: Fetcher, passage: Passage): Promise<ChapterPack | null> {
  const key = `${passage.book.toLowerCase()}.${passage.chapter}`;
  const response = await assets.fetch(new URL(`/bsb/${key}.json`, "https://assets.local"));
  if (!response.ok) return null;
  const pack = (await response.json()) as ChapterPack;
  if (!pack || !Array.isArray(pack.verses)) return null;
  return pack;
}

function fail(c: AppContext, formPost: boolean, status: 404 | 422, error: string): Response {
  if (formPost) return c.html(renderMissing(error), status);
  return c.json({ ok: false, error }, status);
}

function safeBack(slug: string): string {
  const passage = parsePassage(slug);
  return passage ? passageSlug(passage) : "jhn.1";
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export default app;
