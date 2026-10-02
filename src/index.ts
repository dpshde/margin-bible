import { Hono, type Context } from "hono";
import {
  authCookie,
  clearAuthCookie,
  findOrCreateIdentityLibrary,
  identityKeyFromPassphrase,
  readAuthCookie,
  validatePassphrase,
} from "./auth";
import {
  deleteNote,
  ensureLibrary,
  findNote,
  libraryCookie,
  listNotes,
  noteJson,
  readLibraryCookie,
  rememberRead,
  saveNote,
  type NoteRecord,
} from "./library";
import { renderLoginPage } from "./login-page";
import { buildLibrarySnapshot, snapshotFilename } from "./library-snapshot";
import { draftNote } from "./notes";
import { canGo, jumpState } from "./jump-suggest";
import { parsePassage, passageLabel, passageSlug, type Passage } from "./passage";
import { renderChapterPage, renderMissing, renderNotesIndex } from "./reader-page";
import type { ChapterPack } from "./usj";
import { ensureBidirectionalXrefs, syncBidirectionalXrefs } from "./xref-sync";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

type Variables = {
  libraryId: string;
  freshLibrary: boolean;
  signedIn: boolean;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  if (c.req.path === "/health" || c.req.path.startsWith("/bsb/")) {
    await next();
    return;
  }
  const cookieId = readLibraryCookie(c.req.header("Cookie") ?? null);
  const signedIn = readAuthCookie(c.req.header("Cookie") ?? null);
  const library = await ensureLibrary(c.env.DB, cookieId);
  c.set("libraryId", library.id);
  c.set("freshLibrary", library.fresh || cookieId !== library.id);
  // Signed in only when auth cookie is present and the library is passphrase-bound.
  const isSignedIn = Boolean(signedIn && library.identityKey && !c.get("freshLibrary"));
  c.set("signedIn", isSignedIn);
  const secure = new URL(c.req.url).protocol === "https:";
  if (c.get("freshLibrary")) {
    const cookies = [libraryCookie(library.id, secure)];
    if (signedIn) cookies.push(clearAuthCookie(secure));
    for (const cookie of cookies) c.header("Set-Cookie", cookie, { append: true });
  } else if (signedIn && !library.identityKey) {
    // Stale auth cookie on a guest library — drop it.
    c.header("Set-Cookie", clearAuthCookie(secure), { append: true });
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true, app: "margin-bible", version: "2026.09.30.35" }));

app.get("/bsb/*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.get("/vendor/*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.get("/login", (c) => {
  return c.html(
    renderLoginPage({
      next: c.req.query("next") || "/",
      signedIn: c.get("signedIn"),
      notice: c.req.query("claimed") === "1" ? "Library opened. Notes now follow this passphrase." : undefined,
    }),
  );
});

app.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const next = safeNext(typeof form.next === "string" ? form.next : "/");
  const check = validatePassphrase(form.passphrase);
  if (!check.ok) {
    return c.html(renderLoginPage({ error: check.error, next, signedIn: c.get("signedIn") }), 422);
  }
  const label =
    typeof form.label === "string" && form.label.trim()
      ? form.label.normalize("NFKC").trim().slice(0, 80)
      : null;
  const key = await identityKeyFromPassphrase(check.passphrase);
  const library = await findOrCreateIdentityLibrary(c.env.DB, key, label);
  const secure = new URL(c.req.url).protocol === "https:";
  const headers = new Headers();
  headers.append("Set-Cookie", libraryCookie(library.id, secure));
  headers.append("Set-Cookie", authCookie(secure));
  headers.set("Location", next === "/login" ? "/" : next);
  return new Response(null, { status: 303, headers });
});

app.post("/logout", async (c) => {
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
  const next = safeNext(typeof form.next === "string" ? form.next : "/");
  const secure = new URL(c.req.url).protocol === "https:";
  // Drop identity session and mint a fresh anonymous library so prior notes stay private.
  const guest = await ensureLibrary(c.env.DB, null);
  const headers = new Headers();
  headers.append("Set-Cookie", libraryCookie(guest.id, secure));
  headers.append("Set-Cookie", clearAuthCookie(secure));
  headers.set("Location", next);
  return new Response(null, { status: 303, headers });
});

app.get("/", async (c) => {
  const library = await c.env.DB
    .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
    .bind(c.get("libraryId"))
    .first<{ last_read_slug: string | null }>();
  const slug = library?.last_read_slug || "jhn.1";
  return c.redirect(`/${slug}`, 302);
});

app.get("/api/jump-suggest", (c) => {
  const q = c.req.query("q") ?? "";
  const state = jumpState(q);
  return c.json({
    ok: true,
    hits: state.hits,
    hint: state.hint,
    canGo: canGo(q),
  });
});

app.get("/jump", (c) => {
  const passage = parsePassage(c.req.query("q"));
  if (!passage) return c.html(renderMissing("Couldn’t resolve that passage. Try John 3:16 or jhn.3.16."), 422);
  return c.redirect(`/${passageSlug(passage)}`, 302);
});


app.get("/export", async (c) => {
  if (!c.get("signedIn")) {
    return c.redirect(`/login?next=${encodeURIComponent("/export")}`, 302);
  }
  const libraryId = c.get("libraryId");
  const [library, notes] = await Promise.all([
    c.env.DB
      .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
      .bind(libraryId)
      .first<{ last_read_slug: string | null }>(),
    listNotes(c.env.DB, libraryId),
  ]);
  const now = new Date();
  const snapshot = buildLibrarySnapshot({
    lastReadSlug: library?.last_read_slug ?? null,
    readTrail: [],
    notes,
    now,
  });
  const body = JSON.stringify(snapshot, null, 2);
  const filename = snapshotFilename(now);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});

app.get("/notes", async (c) => {
  const libraryId = c.get("libraryId");
  const [library, notes] = await Promise.all([
    c.env.DB
      .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
      .bind(libraryId)
      .first<{ last_read_slug: string | null }>(),
    listNotes(c.env.DB, libraryId),
  ]);
  return c.html(
    renderNotesIndex(notes, safeBack(library?.last_read_slug || "jhn.1"), {
      signedIn: c.get("signedIn"),
    }),
    200,
    { "cache-control": "private, no-store" },
  );
});

app.get("/api/notes", async (c) => {
  const queried = await notesForQuery(c.env.DB, c.get("libraryId"), c.req.query("chapter"), c.req.query("verse"));
  if (!queried.ok) return c.json({ ok: false, error: queried.error }, 422);
  return c.json({ ok: true, notes: queried.notes.map(noteJson), signedIn: c.get("signedIn") });
});

app.put("/api/notes/:slug", (c) => upsert(c, false));
app.post("/api/notes/:slug", (c) => upsert(c, true));

app.get("/:slug", async (c) => {
  const passage = parsePassage(c.req.param("slug"));
  if (!passage) return c.html(renderMissing("Couldn’t resolve that passage."), 404);
  const libraryId = c.get("libraryId");
  const slug = passageSlug(passage);
  // VBV-first: paint scripture ASAP. D1 notes hydrate client-side via /api/notes?chapter=.
  const pack = await loadChapter(c.env.ASSETS, passage);
  c.executionCtx.waitUntil(rememberRead(c.env.DB, libraryId, slug).catch(() => {}));
  if (!pack) return c.html(renderMissing(`No BSB chapter for ${passageLabel(passage)}.`), 404);
  return c.html(
    renderChapterPage({ passage, pack, notes: [], notesPending: true, signedIn: c.get("signedIn") }),
    200,
    { "cache-control": "private, no-store" },
  );
});

async function upsert(c: AppContext, formPost: boolean): Promise<Response> {
  const passage = parsePassage(c.req.param("slug"));
  if (!passage) return fail(c, formPost, 422, "unresolvable");
  const input = await readNoteInput(c);
  if ("error" in input && input.error) return fail(c, formPost, 422, input.error);
  const libraryId = c.get("libraryId");
  const existing = await findNote(c.env.DB, libraryId, passageSlug(passage));
  const ids = () => `b_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const draft = draftNote(
    passage,
    {
      ...input,
      bookmarked: input.bookmarked ?? existing?.bookmarked ?? false,
      previousAttachments: existing?.attachments ?? [],
    },
    ids,
  );
  if (!draft.ok) return fail(c, formPost, 422, draft.error);

  const previous = existing?.attachments ?? [];
  let deleted = false;
  let note: NoteRecord | null = null;
  if (draft.delete) {
    await deleteNote(c.env.DB, libraryId, draft.note.slug);
    deleted = true;
  } else {
    note = await saveNote(c.env.DB, libraryId, draft.note);
  }
  const linkedSlugs = await syncBidirectionalXrefs(
    c.env.DB,
    libraryId,
    draft.note.slug,
    previous,
    draft.delete ? [] : draft.note.attachments,
  );

  if (formPost) return c.redirect(`/${draft.note.slug}`, 303);
  const chapterNotes = await listNotes(c.env.DB, libraryId, { book: passage.book, chapter: passage.chapter });
  return c.json({
    ok: true,
    deleted,
    slug: draft.note.slug,
    bookmarked: note?.bookmarked ?? false,
    attachments: note?.attachments ?? [],
    note: note ? noteJson(note) : null,
    chapterNotes: chapterNotes.map(noteJson),
    linkedSlugs,
    signedIn: c.get("signedIn"),
  });
}

async function readNoteInput(
  c: AppContext,
): Promise<{
  text?: string;
  blocks?: unknown;
  bookmarked?: boolean;
  attachments?: unknown;
  error?: string;
}> {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return { error: "invalid json" };
    const record = body as Record<string, unknown>;
    return {
      text: typeof record.text === "string" ? record.text : undefined,
      blocks: record.blocks,
      bookmarked: record.bookmarked === undefined ? undefined : Boolean(record.bookmarked),
      attachments: record.attachments,
    };
  }
  const form = await c.req.parseBody();
  const text = form.text;
  const bookmarked =
    form.bookmarked === undefined
      ? undefined
      : form.bookmarked === "1" || form.bookmarked === "true";
  let attachments: unknown = undefined;
  if (typeof form.attachments === "string" && form.attachments.trim()) {
    try {
      attachments = JSON.parse(form.attachments);
    } catch {
      return { error: "attachments must be json" };
    }
  }
  return { text: typeof text === "string" ? text : "", bookmarked, attachments };
}

async function notesForQuery(
  db: D1Database,
  libraryId: string,
  chapter: string | undefined,
  verse: string | undefined,
): Promise<{ ok: true; notes: NoteRecord[] } | { ok: false; error: string }> {
  const queried = await listNotesForQuery(db, libraryId, chapter, verse);
  if (!queried.ok) return queried;
  if (!queried.scoped) return { ok: true, notes: queried.notes };
  const linked = await ensureBidirectionalXrefs(db, libraryId, queried.notes);
  if (!linked.length) return { ok: true, notes: queried.notes };
  const again = await listNotesForQuery(db, libraryId, chapter, verse);
  return again.ok ? { ok: true, notes: again.notes } : again;
}

async function listNotesForQuery(
  db: D1Database,
  libraryId: string,
  chapter: string | undefined,
  verse: string | undefined,
): Promise<{ ok: true; notes: NoteRecord[]; scoped: boolean } | { ok: false; error: string }> {
  if (verse) {
    const passage = parsePassage(verse);
    if (!passage?.verseStart) return { ok: false, error: "verse required" };
    const notes = await listNotes(db, libraryId, {
      book: passage.book,
      chapter: passage.chapter,
      verse: passage.verseStart,
    });
    return { ok: true, notes, scoped: true };
  }
  if (chapter) {
    const passage = parsePassage(chapter);
    if (!passage) return { ok: false, error: "unresolvable" };
    const notes = await listNotes(db, libraryId, { book: passage.book, chapter: passage.chapter });
    return { ok: true, notes, scoped: true };
  }
  return { ok: true, notes: await listNotes(db, libraryId), scoped: false };
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

function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login") || raw.startsWith("/logout")) return "/";
  return raw;
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export default app;
