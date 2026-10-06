import { Hono, type Context } from "hono";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  clearAuthCookie,
  clearLibraryCookie,
  clientIp,
  normalizeLabel,
  readSessionCookie,
  requestHasLegacyAuthCookie,
  sessionCookie,
  validatePassphrase,
} from "./auth";
import { createGuestLibrary, createSession, deletePasskey, deleteSession, listPasskeys, readSession } from "./auth-store";
import {
  deleteNote,
  findNote,
  listNotes,
  noteJson,
  rememberRead,
  saveNote,
  type NoteRecord,
} from "./library";
import { renderLoginPage } from "./login-page";
import { buildLibrarySnapshot, snapshotFilename } from "./library-snapshot";
import { draftNote } from "./notes";
import { proxyHiddenArrowSearch, proxyHiddenArrowSuggest } from "./ha-search";
import { collectKeywordVerses, keywordBookSpecs } from "./keyword-search";
import { canGo, jumpState } from "./jump-suggest";
import { performLogin, performPassphraseChange } from "./perform-login";
import {
  authenticationOptions,
  challengeCookie,
  clearChallengeCookie,
  passkeySettings,
  PasskeyError,
  readChallengeCookie,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from "./passkeys";
import { chapterSlug, createPassage, lazyChapterNotes, parsePassage, passageLabel, passageSlug, type Passage } from "./passage";
import { renderChapterPage, renderMissing, renderNotesIndex } from "./reader-page";
import { seedPreviewVerseGroups } from "./preview-seed";
import { handleVerseGroupAction, loadVerseGroups } from "./verse-groups-store";
import { verseGroupCardHtml } from "./verse-groups-ui";
import type { ChapterPack } from "./usj";
import { ensureBidirectionalXrefs, syncBidirectionalXrefs } from "./xref-sync";
import { handleMcpDelete, handleMcpGet, handleMcpOptions, handleMcpPost } from "./mcp";
import { isPwaAssetPath, manifestResponse, pwaIconAssetPath } from "./pwa";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  AUTH_PEPPER?: string;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ORIGIN?: string;
  /** Shared secret for Authorization: Bearer on /mcp (wrangler secret). */
  MCP_BEARER_TOKEN?: string;
  /** D1 library id bound to the MCP bearer (Dylan's notes). */
  MCP_LIBRARY_ID?: string;
  /** Optional Hidden Arrow origin. Defaults to the public Railway app. */
  HIDDEN_ARROW_ORIGIN?: string;
  /** Optional suggest-topics origin. Wins over HIDDEN_ARROW_BASE_URL. */
  HIDDEN_ARROW_SUGGEST_BASE_URL?: string;
  /** Optional Hidden Arrow base when suggest and search share a host other than the default. */
  HIDDEN_ARROW_BASE_URL?: string;
  /** Server-only Hidden Arrow search key. Never sent to the browser. */
  HIDDEN_ARROW_SEARCH_KEY?: string;
  /** Preview worker only. Guest libraries with no web get a few real hubs. */
  PREVIEW_SEED?: string;
};

type Variables = {
  libraryId: string;
  sessionId: string;
  signedIn: boolean;
  sessionCookieSet?: boolean;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

async function loginHtml(
  c: AppContext,
  input: {
    error?: string;
    notice?: string;
    next?: string;
    confirmCreate?: boolean;
    openPassphrase?: boolean;
  } = {},
): Promise<string> {
  const enabled = passkeySettings(c.env, c.req.url) !== null;
  const savedPasskeys = enabled && c.get("signedIn") ? await listPasskeys(c.env.DB, c.get("libraryId")) : [];
  return renderLoginPage({
    ...input,
    signedIn: c.get("signedIn"),
    passkeys: enabled,
    savedPasskeys,
  });
}

app.use("*", async (c, next) => {
  if (
    c.req.path === "/health" ||
    c.req.path === "/mcp" ||
    c.req.path === "/api/ha-search" ||
    c.req.path === "/api/ha-suggest" ||
    c.req.path === "/api/keyword-corpus" ||
    c.req.path.startsWith("/bsb/") ||
    c.req.path.startsWith("/vendor/") ||
    isPwaAssetPath(c.req.path)
  ) {
    await next();
    return;
  }
  const secure = new URL(c.req.url).protocol === "https:";
  const header = c.req.header("Cookie") ?? null;
  const existing = readSessionCookie(header);
  let session = existing ? await readSession(c.env.DB, existing) : null;
  let createdSession: string | null = null;
  if (!session) {
    const libraryId = await createGuestLibrary(c.env.DB);
    createdSession = await createSession(c.env.DB, libraryId);
    session = { id: createdSession, libraryId, bound: false };
  }
  c.set("libraryId", session.libraryId);
  c.set("sessionId", session.id);
  c.set("signedIn", session.bound);
  await next();
  if (createdSession && !c.get("sessionCookieSet")) {
    c.header("Set-Cookie", sessionCookie(createdSession, secure), { append: true });
  }
  if (requestHasLegacyAuthCookie(header)) {
    c.header("Set-Cookie", clearLibraryCookie(secure), { append: true });
    c.header("Set-Cookie", clearAuthCookie(secure), { append: true });
  }
});

app.get("/health", (c) => c.json({ ok: true, app: "margin-bible", version: "2026.10.06.11" }));

app.get("/manifest.webmanifest", () => manifestResponse());
app.get("/manifest.json", () => manifestResponse());
app.get("/apple-touch-icon.png", (c) => servePwaIcon(c));
app.get("/apple-touch-icon-precomposed.png", (c) => servePwaIcon(c));
app.get("/icons/*", (c) => servePwaIcon(c));

app.get("/bsb/*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.get("/vendor/*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.get("/login", async (c) => {
  const passkeyQuery = c.req.query("passkey");
  const notice =
    passkeyQuery === "1"
      ? "Passkey added. It is listed on this page."
      : passkeyQuery === "removed"
        ? "Passkey removed."
        : passkeyQuery === "missing"
          ? "That passkey is already gone."
          : c.req.query("passphrase") === "1"
            ? "Passphrase updated. Other browsers need the new phrase. Passkeys on a device still open this library."
            : c.req.query("claimed") === "1"
              ? "Library opened. This browser now has a session for it."
              : undefined;
  return c.html(await loginHtml(c, { next: c.req.query("next") || "/", notice }));
});

app.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const next = safeNext(typeof form.next === "string" ? form.next : "/");
  const check = validatePassphrase(form.passphrase);
  const page = async (error: string, status: 422 | 429 | 500, confirmCreate = false) =>
    c.html(await loginHtml(c, { error, next, confirmCreate }), status);
  if (!check.ok) return page(check.error, 422);
  const result = await performLogin(c.env.DB, {
    pepper: c.env.AUTH_PEPPER ?? "",
    passphrase: check.passphrase,
    label: normalizeLabel(form.label),
    claimToken: typeof form.claim === "string" ? form.claim : "",
    confirmCreate: form.confirm_create === "1",
    currentLibraryId: c.get("libraryId"),
    currentSessionId: c.get("sessionId"),
    ip: clientIp(c.req.header("CF-Connecting-IP") ?? null),
  });
  if (!result.ok) return page(result.error, result.status, result.confirmCreate);
  return redirectWithSession(c, next, result.sessionId);
});

app.post("/login/passphrase", async (c) => {
  const form = await c.req.parseBody();
  const next = safeNext(typeof form.next === "string" ? form.next : "/");
  const page = async (error: string, status: 422 | 429 | 500) =>
    c.html(await loginHtml(c, { error, next, openPassphrase: true }), status);
  if (!c.get("signedIn")) return page("Sign in before changing the passphrase.", 422);
  const result = await performPassphraseChange(c.env.DB, {
    pepper: c.env.AUTH_PEPPER ?? "",
    currentPassphrase: typeof form.current_passphrase === "string" ? form.current_passphrase : "",
    passphrase: typeof form.passphrase === "string" ? form.passphrase : "",
    confirmPassphrase: typeof form.confirm_passphrase === "string" ? form.confirm_passphrase : "",
    libraryId: c.get("libraryId"),
    currentSessionId: c.get("sessionId"),
    ip: clientIp(c.req.header("CF-Connecting-IP") ?? null),
  });
  if (!result.ok) return page(result.error, result.status);
  return redirectWithSession(c, "/login?passphrase=1", result.sessionId);
});

app.post("/login/passkey/delete", async (c) => {
  if (!c.get("signedIn")) {
    return c.html(await loginHtml(c, { error: "Sign in before removing a passkey.", next: "/" }), 422);
  }
  const form = await c.req.parseBody();
  const credentialId = typeof form.credential_id === "string" ? form.credential_id : "";
  const removed = await deletePasskey(c.env.DB, c.get("libraryId"), credentialId);
  return c.redirect(`/login?passkey=${removed ? "removed" : "missing"}`, 303);
});

app.post("/logout", async (c) => {
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
  const next = safeNext(typeof form.next === "string" ? form.next : "/");
  await deleteSession(c.env.DB, c.get("sessionId"));
  const libraryId = await createGuestLibrary(c.env.DB);
  const sessionId = await createSession(c.env.DB, libraryId);
  return redirectWithSession(c, next, sessionId);
});

app.post("/api/passkey/register/options", async (c) => {
  const settings = passkeySettings(c.env, c.req.url);
  if (!settings) return c.json({ ok: false, error: "Passkeys are not available on this host." }, 404);
  try {
    const { options, challengeId } = await registrationOptions(c.env.DB, settings, c.get("libraryId"));
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", challengeCookie(challengeId, secure), { append: true });
    return c.json({ ok: true, options });
  } catch (error) {
    if (error instanceof PasskeyError) return c.json({ ok: false, error: error.message }, error.status);
    throw error;
  }
});

app.post("/api/passkey/register/verify", async (c) => {
  const settings = passkeySettings(c.env, c.req.url);
  if (!settings) return c.json({ ok: false, error: "Passkeys are not available on this host." }, 404);
  const secure = new URL(c.req.url).protocol === "https:";
  try {
    const body = await c.req.json<RegistrationResponseJSON>();
    await verifyRegistration(
      c.env.DB,
      settings,
      c.get("libraryId"),
      readChallengeCookie(c.req.header("Cookie") ?? null),
      body,
    );
    c.header("Set-Cookie", clearChallengeCookie(secure), { append: true });
    return c.json({ ok: true });
  } catch (error) {
    c.header("Set-Cookie", clearChallengeCookie(secure), { append: true });
    if (error instanceof PasskeyError) return c.json({ ok: false, error: error.message }, error.status);
    throw error;
  }
});

app.post("/api/passkey/login/options", async (c) => {
  const settings = passkeySettings(c.env, c.req.url);
  if (!settings) return c.json({ ok: false, error: "Passkeys are not available on this host." }, 404);
  const { options, challengeId } = await authenticationOptions(c.env.DB, settings);
  const secure = new URL(c.req.url).protocol === "https:";
  c.header("Set-Cookie", challengeCookie(challengeId, secure), { append: true });
  return c.json({ ok: true, options });
});

app.post("/api/passkey/login/verify", async (c) => {
  const settings = passkeySettings(c.env, c.req.url);
  if (!settings) return c.json({ ok: false, error: "Passkeys are not available on this host." }, 404);
  const secure = new URL(c.req.url).protocol === "https:";
  try {
    const body = await c.req.json<AuthenticationResponseJSON>();
    const sessionId = await verifyAuthentication(
      c.env.DB,
      settings,
      readChallengeCookie(c.req.header("Cookie") ?? null),
      body,
      c.get("sessionId"),
    );
    c.set("sessionCookieSet", true);
    c.header("Set-Cookie", sessionCookie(sessionId, secure), { append: true });
    c.header("Set-Cookie", clearChallengeCookie(secure), { append: true });
    return c.json({ ok: true, next: "/" });
  } catch (error) {
    c.header("Set-Cookie", clearChallengeCookie(secure), { append: true });
    if (error instanceof PasskeyError) return c.json({ ok: false, error: error.message }, error.status);
    throw error;
  }
});

/** Home opens the last-read chapter and keeps a shareable `q` search. */
export function homeLocation(slug: string | null | undefined, q: string | null | undefined): string {
  const raw = (slug || "jhn.1").trim().replace(/^\/+/, "") || "jhn.1";
  const query = (q ?? "").trim();
  if (!query) return `/${raw}`;
  const params = new URLSearchParams();
  params.set("q", query);
  return `/${raw}?${params.toString()}`;
}

app.get("/", async (c) => {
  const library = await c.env.DB
    .prepare("SELECT last_read_slug FROM libraries WHERE id = ?")
    .bind(c.get("libraryId"))
    .first<{ last_read_slug: string | null }>();
  return c.redirect(homeLocation(library?.last_read_slug, c.req.query("q")), 302);
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

let keywordCorpusJson: Promise<string> | null = null;

app.get("/api/keyword-corpus", async (c) => {
  if (!keywordCorpusJson) {
    keywordCorpusJson = collectKeywordVerses(keywordBookSpecs(), async (code, chapter) => {
      const pack = await loadChapter(c.env.ASSETS, createPassage(code, chapter));
      return pack ? { verses: pack.verses } : null;
    })
      .then((rows) => JSON.stringify(rows))
      .catch((error) => {
        keywordCorpusJson = null;
        throw error;
      });
  }
  const body = await keywordCorpusJson;
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
});

app.post("/api/ha-search", async (c) => {
  let query = "";
  try {
    const body = await c.req.json<{ query?: unknown }>();
    query = typeof body?.query === "string" ? body.query : "";
  } catch {
    return c.json({ ok: false }, 400, { "cache-control": "no-store" });
  }
  return proxyHiddenArrowSearch(query, {
    origin: c.env?.HIDDEN_ARROW_ORIGIN,
    apiKey: c.env?.HIDDEN_ARROW_SEARCH_KEY,
  });
});

app.post("/api/ha-suggest", async (c) => {
  let recent: unknown;
  try {
    const body = await c.req.json<{ recent?: unknown }>();
    recent = body?.recent;
  } catch {
    return c.json({ ok: false }, 400, { "cache-control": "no-store" });
  }
  return proxyHiddenArrowSuggest(recent, {
    suggestBase: c.env?.HIDDEN_ARROW_SUGGEST_BASE_URL,
    base: c.env?.HIDDEN_ARROW_BASE_URL,
    origin: c.env?.HIDDEN_ARROW_ORIGIN,
    apiKey: c.env?.HIDDEN_ARROW_SEARCH_KEY,
  });
});

app.get("/jump", (c) => {
  const passage = parsePassage(c.req.query("q"));
  if (!passage) return c.html(renderMissing("Couldn’t resolve that passage. Try John 3:16 or jhn.3.16."), 422);
  return c.redirect(`/${passageSlug(passage)}`, 302);
});

// MCP Streamable HTTP (Bearer). Registered before /:slug; skips session minting.
app.options("/mcp", (c) => handleMcpOptions());
app.get("/mcp", (c) => handleMcpGet(c));
app.delete("/mcp", (c) => handleMcpDelete(c));
app.post("/mcp", (c) => handleMcpPost(c));


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
    notesForInbox(c),
  ]);
  const verseGroups = await loadVerseGroups(c.env.DB, libraryId, notes);
  return c.html(
    renderNotesIndex(notes, safeBack(library?.last_read_slug || "jhn.1"), {
      signedIn: c.get("signedIn"),
      verseGroups,
    }),
    200,
    { "cache-control": "private, no-store" },
  );
});

app.get("/api/verse-groups", async (c) => {
  const libraryId = c.get("libraryId");
  const notes = await notesForInbox(c);
  const groups = await loadVerseGroups(c.env.DB, libraryId, notes);
  c.header("cache-control", "private, no-store");
  return c.json({ ok: true, groups });
});

app.post("/api/verse-groups", async (c) => {
  const body = await c.req.json().catch(() => null);
  const result = await handleVerseGroupAction(c.env.DB, c.get("libraryId"), body);
  c.header("cache-control", "private, no-store");
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
  return c.json({
    ok: true,
    status: result.statusText,
    cardHtml: verseGroupCardHtml(result.group, result.statusText),
  });
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
  // Chapters paint scripture first and hydrate notes. A verse or range waits for that note.
  // ?chapter_note=1 is the exception: the note has to be in the first HTML, already open.
  const chapterNoteOpen = c.req.query("chapter_note") === "1";
  const xrefArrival = c.req.query("xref") === "1";
  const eagerNotes = !lazyChapterNotes(passage) || chapterNoteOpen;
  const packPromise = loadChapter(c.env.ASSETS, passage);
  const notesPromise = eagerNotes
    ? notesForQuery(c.env.DB, libraryId, chapterSlug(passage), undefined)
    : Promise.resolve(null);
  c.executionCtx.waitUntil(rememberRead(c.env.DB, libraryId, slug).catch(() => {}));
  const [pack, queried] = await Promise.all([packPromise, notesPromise]);
  if (!pack) return c.html(renderMissing(`No BSB chapter for ${passageLabel(passage)}.`), 404);
  const notes = queried && queried.ok ? queried.notes : [];
  return c.html(
    renderChapterPage({
      passage,
      pack,
      notes,
      notesPending: !eagerNotes,
      chapterNoteOpen,
      xrefArrival,
      signedIn: c.get("signedIn"),
    }),
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

async function servePwaIcon(c: AppContext): Promise<Response> {
  const assetPath = pwaIconAssetPath(c.req.path);
  if (!assetPath) return c.notFound();
  const fetched = await c.env.ASSETS.fetch(new URL(assetPath, "https://assets.local"));
  if (!fetched.ok) return c.notFound();
  return new Response(fetched.body, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    },
  });
}

async function notesForInbox(c: AppContext): Promise<Awaited<ReturnType<typeof listNotes>>> {
  const libraryId = c.get("libraryId");
  let notes = await listNotes(c.env.DB, libraryId);
  if (c.env.PREVIEW_SEED === "1" && !c.get("signedIn")) {
    const seeded = await seedPreviewVerseGroups(c.env.DB, libraryId, notes);
    if (seeded) notes = await listNotes(c.env.DB, libraryId);
  }
  return notes;
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

function redirectWithSession(c: AppContext, next: string, sessionId: string): Response {
  const secure = new URL(c.req.url).protocol === "https:";
  c.set("sessionCookieSet", true);
  c.header("Set-Cookie", sessionCookie(sessionId, secure), { append: true });
  return c.redirect(next, 303);
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
