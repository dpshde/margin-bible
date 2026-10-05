import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import app, { homeLocation, type Env } from "../src/index";
import {
  HIDDEN_ARROW_ORIGIN,
  hiddenArrowOrigin,
  hiddenArrowSearchRequest,
  hiddenArrowSuggestUrl,
  marginPathFromRouteHref,
  normalizeRecentSearches,
  proxyHiddenArrowSearch,
  proxyHiddenArrowSuggest,
  shouldQueryHiddenArrow,
} from "../src/ha-search";
import { canGo, jumpState } from "../src/jump-suggest";
import { marginPathInTestament, testamentCodes } from "../src/books";
import { isSearchChord, jumpScript } from "../src/jump-ui";

const hrefs: Array<[string, string | null]> = [
  ["https://route.bible/mrk.12.31?src=hidden-arrow", "/mrk.12.31"],
  ["https://www.route.bible/mat.22.37-39?src=hidden-arrow", "/mat.22.37-39"],
  ["https://route.bible/rom.13.8-9", "/rom.13.8-9"],
  ["https://route.bible/1co.13.1-13?src=hidden-arrow", "/1co.13.1-13"],
  ["https://route.bible/jas.2.8-16", "/jas.2.8-16"],
  ["https://route.bible/lev.19.18?src=hidden-arrow", "/lev.19.18"],
  ["https://route.bible/MRK.12.31", "/mrk.12.31"],
  ["https://example.com/mrk.12.31", null],
  ["https://route.bible/zzz.1.1", null],
  ["https://route.bible/mrk.12.999", null],
  ["https://route.bible/?q=John+3:16", null],
  ["not a url", null],
];

function browserMarginPath(): (href: string | null) => string | null {
  const source = jumpScript();
  const start = source.indexOf("function marginPathFromRouteHref");
  const end = source.indexOf("function syncKeyboardInset");
  const fnSource = source.slice(start, end);
  return new Function(`${fnSource}; return marginPathFromRouteHref;`)() as (href: string | null) => string | null;
}

describe("Hidden Arrow hrefs open inside Margin", () => {
  test("maps route.bible passage pathnames onto reader routes", () => {
    for (const [href, path] of hrefs) {
      expect(marginPathFromRouteHref(href), href).toBe(path);
    }
  });

  test("the search box uses the same pathname mapping and does not call Railway", () => {
    const source = jumpScript();
    expect(source).toContain('fetch("/api/ha-search"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain("JSON.stringify({ query: q })");
    expect(source).not.toContain("railway.app");
    expect(source).not.toContain("hidden-arrow");
    expect(source).not.toContain("scheduleScripture");
    expect(source).not.toContain(", 280)");
    const suggestNow = source.slice(source.indexOf("async function suggestNow"), source.indexOf("async function submitJump"));
    expect(suggestNow).toContain("/api/jump-suggest");
    expect(suggestNow).not.toContain("/api/ha-search");
    expect(suggestNow).not.toContain("showSearchSkeletons");
    const searching = source.slice(source.indexOf("async function searchScripture"), source.indexOf("async function suggestNow"));
    expect(searching).toContain('fetch("/api/ha-search"');
    expect(searching).not.toContain("keepKeyword");
    expect(searching).toContain("writeSearchCache(q, next, true)");
    expect(searching).toContain("close()");
    expect(searching).toContain("showSearchUnavailable()");
    expect(searching).not.toContain("showSearchSkeletons");
    expect(searching).not.toContain("Loading");
    expect(searching).not.toContain("attribution");
    expect(source).not.toContain("openbible.info");
    expect(source).not.toContain("STEPBible");
    expect(source).not.toContain("flexsearch");
    expect(source).not.toContain("NASB");
    expect(source).not.toContain("ESV");
    expect(source).not.toContain("NIV");
    expect(source).not.toContain("LEB");
    const reveal = source.slice(source.indexOf("function revealCachedSearch"), source.indexOf("function openFromHeader"));
    expect(reveal).toContain("readSearchCache");
    expect(reveal).toContain("render({ hits: cache.hits })");
    expect(reveal).not.toContain("fetch(");
    expect(reveal).not.toContain("showSearchSkeletons");
    expect(source).toContain("margin-search-cache");
    expect(source).toContain("sessionStorage");
    expect(source).not.toContain("/api/keyword-corpus");
    expect(source).not.toContain("requestIdleCallback");
    expect(source).not.toContain("searchKeywordIndex");
    expect(source).not.toContain("buildKeywordIndex");
    expect(source).toContain("search-modal");
    expect(source).toContain("search-fab");
    const skeletons = source.slice(source.indexOf("function showSearchSkeletons"), source.indexOf("function render"));
    expect(skeletons).toContain("suggest-skeleton");
    expect(skeletons).toContain("suggest-skeleton-ref");
    expect(skeletons).toContain("suggest-skeleton-text");
    expect(skeletons).toContain("i < 4");
    expect(skeletons).toContain('aria-busy", "true"');
    const unavailable = source.slice(source.indexOf("function showSearchUnavailable"), source.indexOf("function render"));
    expect(unavailable).toContain("Search unavailable");
    expect(unavailable).toContain("search-unavailable");
    expect(unavailable).toContain('role="status"');
    expect(unavailable).not.toContain("<button");
    const submit = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    expect(submit).toContain("searchScripture(q, my)");
    expect(submit).not.toContain("keepKeyword");
    expect(submit.indexOf("showSearchSkeletons()")).toBeGreaterThan(-1);
    expect(submit.indexOf("showSearchSkeletons()")).toBeLessThan(submit.indexOf("searchScripture(q, my)"));
    expect(submit).not.toContain("searchKeywordIndex");
    expect(submit).toContain('"/jump?q=" + encodeURIComponent(q)');
    expect(submit).toContain("location.assign(jumpUrl)");
    expect(submit).toContain("location.replace(jumpUrl)");
    expect(submit).toContain("data.canGo");
    const fromScript = browserMarginPath();
    expect(fromScript("https://route.bible/mrk.12.31?src=hidden-arrow")).toBe("/mrk.12.31");
    expect(fromScript("https://route.bible/mat.22.37-39?src=hidden-arrow")).toBe("/mat.22.37-39");
    expect(fromScript("https://route.bible/1co.13.1-13?src=hidden-arrow")).toBe("/1co.13.1-13");
    expect(fromScript("https://example.com/mrk.12.31")).toBeNull();
    expect(fromScript("https://route.bible/not-a-passage")).toBeNull();
  });
});

describe("search focus chord", () => {
  test("Cmd+K on Apple platforms, Ctrl+K elsewhere, including while a field is focused", () => {
    expect(isSearchChord({ key: "k", metaKey: true }, "MacIntel")).toBe(true);
    expect(isSearchChord({ key: "K", metaKey: true }, "iPhone")).toBe(true);
    expect(isSearchChord({ code: "KeyK", metaKey: true }, "iPad")).toBe(true);
    expect(isSearchChord({ key: "k", ctrlKey: true }, "MacIntel")).toBe(false);
    expect(isSearchChord({ key: "k", ctrlKey: true }, "Win32")).toBe(true);
    expect(isSearchChord({ key: "k", ctrlKey: true }, "Linux x86_64")).toBe(true);
    expect(isSearchChord({ key: "k", metaKey: true }, "Linux x86_64")).toBe(false);
    expect(isSearchChord({ key: "k", ctrlKey: true, shiftKey: true }, "Linux")).toBe(false);
    expect(isSearchChord({ key: "k", ctrlKey: true, altKey: true }, "Linux")).toBe(false);
    expect(isSearchChord({ key: "k", ctrlKey: true, repeat: true }, "Linux")).toBe(false);
    expect(isSearchChord({ key: "j", ctrlKey: true }, "Linux")).toBe(false);
    expect(isSearchChord({ key: "/", metaKey: true }, "MacIntel")).toBe(false);
  });

  test("the page chord is capture-phase and slash and j still ignore fields", () => {
    const source = jumpScript();
    const chord = source.slice(source.indexOf("function isSearchChord"), source.indexOf("if (!window.__marginJumpShortcutBound)"));
    expect(chord).toContain('key !== "k" && key !== "K" && event.code !== "KeyK"');
    expect(chord).toContain("event.metaKey) && !event.ctrlKey");
    expect(chord).toContain("event.ctrlKey) && !event.metaKey");
    const listener = source.slice(source.indexOf("if (!window.__marginJumpShortcutBound)"));
    expect(listener).toContain("if (!isSearchChord(event)) return;");
    expect(listener).toContain("if (!focusVisibleJump()) return;");
    expect(listener).toContain("event.preventDefault()");
    expect(listener).toContain("event.stopPropagation()");
    const focus = source.slice(source.indexOf("function focusVisibleJump"), source.indexOf("function isSearchChord"));
    expect(focus).toContain("input.focus()");
    expect(focus).toContain("input.select()");
    expect(listener).toContain("}, true);");
    expect(listener).toContain('event.key !== "/" && event.key !== "j"');
    expect(listener).toContain('tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable');
    expect(listener).not.toContain("verse-rail");
    expect(source).toContain("searchScripture(q, my)");
    expect(source).not.toContain("keepKeyword");
    expect(source).not.toContain("scheduleScripture");
  });
});

describe("when the jump box should search", () => {
  function decide(query: string) {
    const state = jumpState(query);
    return shouldQueryHiddenArrow({
      query,
      hits: state.hits,
      hint: state.hint,
      canGo: canGo(query),
    });
  }

  test("a resolved reference still jumps", () => {
    expect(decide("John 3:16")).toBe(false);
    expect(decide("jhn.3.16")).toBe(false);
    expect(decide("John 3")).toBe(false);
    expect(decide("Deuteronomy ")).toBe(false);
    expect(decide("Joh")).toBe(false);
  });

  test("free text searches Hidden Arrow", () => {
    expect(decide("love your neighbor")).toBe(true);
    expect(decide("  neighbor  ")).toBe(true);
    expect(decide("")).toBe(false);
  });
});

describe("Hidden Arrow proxy request", () => {
  test("posts {query} to the public origin", () => {
    const request = hiddenArrowSearchRequest("  love your neighbor  ");
    expect(request.url).toBe(`${HIDDEN_ARROW_ORIGIN}/api/search`);
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toEqual({ query: "love your neighbor" });
  });

  test("origin override replaces the host and ignores a bad value", () => {
    expect(hiddenArrowOrigin("https://arrow.test/extra")).toBe("https://arrow.test");
    expect(hiddenArrowOrigin("not a url")).toBe(HIDDEN_ARROW_ORIGIN);
    expect(hiddenArrowOrigin("")).toBe(HIDDEN_ARROW_ORIGIN);
    const request = hiddenArrowSearchRequest("love", "https://arrow.test/ignored");
    expect(request.url).toBe("https://arrow.test/api/search");
    expect(JSON.parse(request.body)).toEqual({ query: "love" });
  });

  test("forwards the query and returns upstream JSON with no-store", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const upstream = {
      request_id: "r",
      query: "love your neighbor",
      ms: 4,
      evidence: [
        {
          displayRef: "Mark 12:31",
          text: "Love your neighbor as yourself.",
          href: "https://route.bible/mrk.12.31?src=hidden-arrow",
        },
      ],
      notices: [],
      attribution: ["Topics and cross references from openbible.info (CC BY 4.0)"],
    };
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(upstream), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const res = await proxyHiddenArrowSearch("love your neighbor", {
      origin: "https://arrow.test",
      apiKey: "test-search-key",
      fetchImpl,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-api-key")).toBeNull();
    const body = await res.json();
    expect(body).toEqual(upstream);
    expect(JSON.stringify(body)).not.toContain("test-search-key");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe("https://arrow.test/api/search");
    expect(seen[0]?.init.method).toBe("POST");
    const sent = new Headers(seen[0]?.init.headers);
    expect(sent.get("content-type")).toBe("application/json");
    expect(sent.get("x-api-key")).toBe("test-search-key");
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ query: "love your neighbor" });
  });

  test("a missing search key does not call Hidden Arrow", async () => {
    let called = 0;
    const fetchImpl = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const res = await proxyHiddenArrowSearch("love your neighbor", { apiKey: "  ", fetchImpl });
    expect(called).toBe(0);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-api-key")).toBeNull();
    expect(await res.json()).toEqual({ ok: false, error: "Scripture search is not configured." });
  });

  test("an upstream echo of the key is removed before the browser sees it", async () => {
    const fetchImpl = (async () => {
      return new Response(JSON.stringify({ evidence: [], echo: "test-search-key" }), {
        status: 200,
        headers: { "content-type": "application/json", "x-api-key": "test-search-key" },
      });
    }) as typeof fetch;
    const res = await proxyHiddenArrowSearch("neighbor", { apiKey: "test-search-key", fetchImpl });
    expect(res.headers.get("x-api-key")).toBeNull();
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain("test-search-key");
  });

  test("a down upstream fails quietly", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const res = await proxyHiddenArrowSearch("love your neighbor", { apiKey: "test-search-key", fetchImpl });
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe("POST /api/ha-search", () => {
  test("same-origin route forwards {query} and does not require a session", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          request_id: "r",
          query: "love your neighbor",
          ms: 1,
          evidence: [],
          notices: [],
          attribution: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const env = { HIDDEN_ARROW_SEARCH_KEY: "test-search-key" } as Env;
      const res = await app.request(
        "http://margin.test/api/ha-search",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: " love your neighbor " }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-api-key")).toBeNull();
      const data = await res.json();
      expect(data.query).toBe("love your neighbor");
      expect(JSON.stringify(data)).not.toContain("test-search-key");
      expect(seen[0]?.url).toBe(`${HIDDEN_ARROW_ORIGIN}/api/search`);
      expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ query: "love your neighbor" });
      expect(new Headers(seen[0]?.init.headers).get("x-api-key")).toBe("test-search-key");
      expect(res.headers.get("set-cookie")).toBeNull();
    } finally {
      globalThis.fetch = real;
    }
  });

  test("optional origin override is the upstream host", async () => {
    const seen: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response(JSON.stringify({ evidence: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const env = {
        HIDDEN_ARROW_ORIGIN: "https://preview.arrow.test/nope",
        HIDDEN_ARROW_SEARCH_KEY: "test-search-key",
      } as Env;
      const res = await app.request(
        "http://margin.test/api/ha-search",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "neighbor" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(seen).toEqual(["https://preview.arrow.test/api/search"]);
      expect(JSON.stringify(await res.json())).not.toContain("test-search-key");
    } finally {
      globalThis.fetch = real;
    }
  });

  test("an unset search key returns an error and does not call upstream", async () => {
    let called = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const res = await app.request(
        "http://margin.test/api/ha-search",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "neighbor" }),
        },
        {} as Env,
      );
      expect(called).toBe(0);
      expect(res.status).toBe(503);
      expect(res.headers.get("x-api-key")).toBeNull();
      expect(await res.json()).toEqual({ ok: false, error: "Scripture search is not configured." });
      expect(jumpScript()).not.toContain("x-api-key");
      expect(jumpScript()).not.toContain("HIDDEN_ARROW_SEARCH_KEY");
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("shareable search query", () => {
  test("home keeps q on the way to the last-read chapter", () => {
    expect(homeLocation(null, null)).toBe("/jhn.1");
    expect(homeLocation("jhn.3", "  ")).toBe("/jhn.3");
    expect(homeLocation("jhn.1", "love your neighbor")).toBe("/jhn.1?q=love+your+neighbor");
    expect(homeLocation(null, "John 3:16")).toBe("/jhn.1?q=John+3%3A16");
    const url = new URL(homeLocation("mrk.12", "love your neighbor"), "http://margin.test");
    expect(url.pathname).toBe("/mrk.12");
    expect(url.searchParams.get("q")).toBe("love your neighbor");
  });

  test("opening q submits the same search and a later submit updates q", () => {
    const source = jumpScript();
    const boot = source.slice(source.indexOf("function bootSearchQuery"), source.indexOf("function bindAll"));
    expect(boot).toContain('searchParams.get("q")');
    expect(boot).toContain("input.value = q");
    expect(boot).toContain("visible.requestSubmit()");
    expect(boot).not.toContain("/api/ha-search");
    const sync = source.slice(source.indexOf("function syncSearchQuery"), source.indexOf("function bootSearchQuery"));
    expect(sync).toContain('searchParams.set("q", next)');
    expect(sync).toContain("history.replaceState");
    const submit = source.slice(source.indexOf('form.addEventListener("submit"'), source.indexOf("function syncSearchQuery"));
    expect(submit.indexOf("syncSearchQuery(q)")).toBeLessThan(submit.indexOf("submitJump(q)"));
    expect(source).toContain("bootSearchQuery()");
    expect(source).not.toContain("scheduleScripture");
  });
});

describe("clearing the modal input", () => {
  test("clear hides results and closing restores the cached query", () => {
    const source = jumpScript();
    const modal = source.slice(source.indexOf("function ensureSearchModal"), source.indexOf("function ensureSearchFab"));
    const onInput = modal.slice(modal.indexOf('input.addEventListener("input"'), modal.indexOf('list.addEventListener("click"'));
    expect(onInput).toContain("seq += 1");
    expect(onInput).toContain("close()");
    expect(onInput).not.toContain("clearSearchCache");
    expect(onInput).not.toContain("writeSearchCache");
    expect(onInput).not.toContain("fetch(");
    expect(onInput).not.toContain("/api/ha-search");
    const closeList = source.slice(source.indexOf("function close()"), source.indexOf("function showSearchSkeletons"));
    expect(closeList).toContain("list.hidden = true");
    expect(closeList).toContain('list.innerHTML = ""');
    expect(closeList).not.toContain("clearSearchCache");
    expect(closeList).not.toContain("sessionStorage");
    const closeModal = source.slice(source.indexOf("function closeSearchModal"), source.indexOf("function revealCachedSearch"));
    expect(closeModal).toContain("readSearchCache()");
    expect(closeModal).toContain("mirrorHeader(cache.query)");
    expect(closeModal).not.toContain("clearSearchCache");
    const reveal = source.slice(source.indexOf("function revealCachedSearch"), source.indexOf("function openFromHeader"));
    expect(reveal).toContain("input.value = cache.query");
    expect(reveal).toContain("submittedQuery = cache.query");
    expect(reveal).toContain("render({ hits: cache.hits })");
    expect(reveal).not.toContain("fetch(");
    expect(reveal).not.toContain("/api/ha-search");
  });

  test("submitting a new search replaces the cache", () => {
    const source = jumpScript();
    const modal = source.slice(source.indexOf("function ensureSearchModal"), source.indexOf("function ensureSearchFab"));
    const onSubmit = modal.slice(modal.indexOf('searchForm.addEventListener("submit"'), modal.indexOf('input.addEventListener("keydown"'));
    expect(onSubmit.indexOf("if (!q)")).toBeLessThan(onSubmit.indexOf("mirrorHeader(q)"));
    expect(onSubmit.indexOf("mirrorHeader(q)")).toBeLessThan(onSubmit.indexOf("syncSearchQuery(q)"));
    expect(onSubmit.indexOf("syncSearchQuery(q)")).toBeLessThan(onSubmit.indexOf("submitJump(q)"));
    expect(onSubmit).toContain("close()");
    const submit = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    expect(submit).toContain("writeSearchCache(q, data.hits || [])");
    expect(submit).toContain("searchScripture(q, my)");
    expect(submit).not.toContain("keywordHits");
    const searching = source.slice(source.indexOf("async function searchScripture"), source.indexOf("async function suggestNow"));
    expect(searching).toContain("writeSearchCache(q, next, true)");
    const writing = source.slice(source.indexOf("function writeSearchCache"), source.indexOf("function clearSearchCache"));
    expect(writing).toContain('sessionStorage.setItem("margin-search-cache"');
    expect(writing).toContain('query: String(query || "")');
    expect(writing).toContain("hits: packed");
    expect(writing).toContain("testament: normalizeTestament(searchTestament)");
    expect(writing).toContain("scripture: Boolean(scripture)");
  });
});

describe("search list stays on screen", () => {
  test("suggest list scrolls inside the viewport and above the keyboard", () => {
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    expect(css).toContain(".suggest-scripture");
    expect(css).toContain(".suggest-text");
    expect(css).toContain(".suggest-skeleton");
    expect(css).toContain(".suggest-skeleton-ref");
    expect(css).toContain(".suggest-skeleton-text");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("max-height: calc(1.35em * 3)");
    expect(css).toContain("var(--keyboard-inset, 0px)");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain(".search-fab { display: none; }");
    expect(css).toContain("bottom: calc(14px + env(safe-area-inset-bottom, 0px))");
    expect(css).toContain("right: calc(14px + env(safe-area-inset-right, 0px))");
    expect(css).toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span)) .search-fab");
    expect(css).toContain(".search-modal");
    const modalBox = css.slice(css.indexOf(".search-modal {"), css.indexOf(".search-modal[hidden]"));
    expect(modalBox).toContain("align-items: center");
    expect(modalBox).not.toContain("flex-start");
    expect(modalBox).toContain("var(--vv-top, 0px)");
    expect(modalBox).toContain("var(--vv-height, 100dvh)");
    expect(modalBox).toContain("--search-gutter:");
    const source = jumpScript();
    const inset = source.slice(source.indexOf("function syncKeyboardInset"), source.indexOf("function escape"));
    expect(inset).toContain('setProperty("--vv-top"');
    expect(inset).toContain('setProperty("--vv-height"');
    expect(inset).toContain("vv.offsetTop");
    expect(inset).toContain("vv.height");
    expect(css).toContain(".search-result-ref");
    expect(css).toContain("text-transform: uppercase");
    const backdrop = css.slice(css.indexOf(".search-modal-backdrop"), css.indexOf(".search-modal-panel {"));
    expect(backdrop).toContain("rgb(28 25 23 / 0.9)");
    expect(backdrop).toContain("#000000e6");
    expect(backdrop).toContain("-webkit-backdrop-filter: blur(4px)");
    expect(backdrop).toContain("backdrop-filter: blur(4px)");
    expect(backdrop).not.toContain("var(--ink)");
    const panel = css.slice(css.indexOf(".search-modal-panel {"), css.indexOf(".search-modal-form {"));
    expect(panel).not.toContain("box-shadow");
    const field = css.slice(css.indexOf(".search-modal-bar"), css.indexOf(".search-modal-list {"));
    expect(field).toContain("align-items: center");
    expect(field).toContain("padding: 12px 14px");
    expect(field).not.toContain("border-bottom");
    expect(field).toContain(".search-modal-icon");
    expect(field).not.toContain("search-modal-translation");
    expect(field).not.toContain("search-modal-footer");
    expect(field).toContain(".search-modal-form:has(.search-modal-list:not([hidden])) .search-modal-bar::after");
    expect(source).toContain('footer.textContent = "BSB"');
    expect(source).toContain("search-modal-footer");
    expect(source).toContain("search-modal-icon");
    expect(source).not.toContain("search-modal-cancel");
    expect(source).not.toContain("Cancel");
    expect(source).toContain("function bindSheetSwipe");
    expect(source).toContain("const limit = 80");
    expect(source).toContain("history.pushState");
    expect(source).toContain("history.back()");
    expect(source).toContain('addEventListener("popstate"');
    expect(source).toContain("search-modal-results");
    expect(source).not.toContain("search-modal-translation");
    const footer = css.slice(css.indexOf(".search-modal-footer {"), css.indexOf("html[data-theme=\"dark\"] .search-modal-footer"));
    expect(footer).toContain("display: none");
    expect(footer).toContain("text-align: left");
    expect(footer).toContain("background: transparent");
    expect(footer).toContain("color: #a8a29e");
    expect(footer).not.toContain("border-radius");
    expect(css).toContain(".search-modal-form:has(.search-modal-list:not([hidden])) .search-modal-footer { display: block; }");
    expect(field).toContain("padding: .25rem 0");
    expect(field).toContain("line-height: 1.25");
    expect(field).toContain("font-size: 1.125rem");
    expect(field).not.toContain("3.5rem");
    const mark = css.slice(css.indexOf(".search-mark {"), css.indexOf("html.search-modal-open"));
    expect(mark).toContain("color: #ea580c");
    expect(mark).toContain("color: #fb923c");
    expect(mark).toContain("font-weight: 600");
    expect(mark).not.toContain("text-shadow");
    expect(mark).not.toContain("fdba74");
    const list = css.slice(css.indexOf(".search-modal-list {"), css.indexOf(".search-modal-list[hidden]"));
    expect(list).toContain("overflow-y: auto");
    expect(list).toContain("scrollbar-width: none");
    expect(css).toContain(".search-modal-list::-webkit-scrollbar");
    expect(css).not.toContain("search-modal-cancel");
    const sheet = css.slice(css.indexOf("@media (max-width: 640px)"), css.indexOf(".section-head {"));
    expect(sheet).toContain("@media (max-width: 640px)");
    expect(sheet).toContain("padding: 0");
    expect(sheet).toContain("border-radius: 0");
    expect(sheet).toContain("env(safe-area-inset-top, 0px)");
    expect(sheet).toContain("env(safe-area-inset-bottom, 0px)");
    expect(sheet).toContain(".search-modal-results");
    expect(sheet).toContain("scrollbar-width: none");
    expect(css).toContain("html.search-modal-open .search-fab");
    expect(css).toContain("visibility: hidden");
    expect(css).toContain("pointer-events: none");
  });
});

describe("topic suggestion chips", () => {
  test("recent searches are newest-first, deduped, and capped at 10", () => {
    const source = jumpScript();
    const start = source.indexOf("function readRecentSearches");
    const end = source.indexOf("function cleanTopics");
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const api = new Function(
      "localStorage",
      `${source.slice(start, end)}; return { readRecentSearches, rememberRecentSearch };`,
    )(localStorage) as {
      readRecentSearches: () => string[];
      rememberRecentSearch: (query: string) => void;
    };
    api.rememberRecentSearch("  Tree of life ");
    api.rememberRecentSearch("love");
    api.rememberRecentSearch("tree of life");
    expect(api.readRecentSearches()).toEqual(["tree of life", "love"]);
    for (let i = 0; i < 12; i++) api.rememberRecentSearch("q" + i);
    const recent = api.readRecentSearches();
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe("q11");
    expect(recent).not.toContain("love");
    expect(store.get("margin-recent-searches")).toContain("q11");
  });

  test("chips load once per open from the session cache and stay quiet on failure", () => {
    const source = jumpScript();
    const load = source.slice(source.indexOf("async function loadTopicSuggestions"), source.indexOf("async function searchScripture"));
    expect(load.indexOf("recent.length < 2")).toBeGreaterThan(-1);
    expect(load.indexOf("readTopicCache(recent)")).toBeLessThan(load.indexOf('fetch("/api/ha-suggest"'));
    expect(load.indexOf("if (suggestAttempted) return")).toBeLessThan(load.indexOf('fetch("/api/ha-suggest"'));
    expect(load.indexOf("suggestAttempted = true")).toBeLessThan(load.indexOf('fetch("/api/ha-suggest"'));
    expect(load.match(/fetch\("\/api\/ha-suggest"/g)?.length).toBe(1);
    expect(load).toContain('JSON.stringify({ recent: recent })');
    expect(load).toContain("if (!res.ok)");
    const failed = load.slice(load.indexOf("if (!res.ok)"), load.indexOf("const data = await res.json()"));
    expect(failed).toContain("hideTopicChips()");
    expect(failed).not.toContain("writeTopicCache");
    expect(failed).not.toContain("Search unavailable");
    expect(source).toContain('sessionStorage.getItem("margin-suggest-cache")');
    expect(source).toContain('sessionStorage.setItem("margin-suggest-cache"');
    expect(source).toContain('localStorage.getItem("margin-recent-searches")');
    expect(source).toContain('localStorage.setItem("margin-recent-searches"');
    expect(source).not.toContain('textContent = "Suggested"');
    expect(source).not.toContain("search-suggest-label");
    expect(source).toContain("search-suggest-chip");
    expect(source).toContain('btn.setAttribute("data-query", topic.query)');
    expect(source).not.toContain("x-api-key");
    expect(source).not.toContain("HIDDEN_ARROW_SEARCH_KEY");
    const open = source.slice(source.indexOf("function openSearchModal"), source.indexOf("function closeSearchModal"));
    expect(open).toContain("if (opening)");
    expect(open).toContain("suggestAttempted = false");
    expect(open).toContain("loadTopicSuggestions()");
    const submit = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    const passage = submit.slice(0, submit.indexOf("if ((data.hits"));
    expect(passage).not.toContain("rememberRecentSearch");
    const freeText = submit.slice(submit.lastIndexOf("submittedQuery = q"));
    expect(freeText.indexOf("rememberRecentSearch(q)")).toBeLessThan(freeText.indexOf("showSearchSkeletons()"));
    expect(freeText.indexOf("showSearchSkeletons()")).toBeLessThan(freeText.indexOf("searchScripture(q, my)"));
    const typed = source.slice(source.indexOf('input.addEventListener("input"'), source.indexOf("topicChips.addEventListener"));
    expect(typed).toContain("hideTopicChips()");
    expect(typed).toContain("loadTopicSuggestions()");
    expect(typed).not.toContain("clearSearchCache");
    expect(typed).not.toContain("fetch(");
    expect(typed).not.toContain("/api/ha-suggest");
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const chips = css.slice(css.indexOf(".search-suggest {"), css.indexOf(".search-result {"));
    expect(chips).toContain(".search-suggest[hidden] { display: none; }");
    expect(chips).toContain("flex-wrap: nowrap");
    expect(chips).toContain("overflow-x: auto");
    expect(chips).toContain("scrollbar-width: none");
    expect(chips).toContain(".search-suggest-chips::-webkit-scrollbar { display: none; width: 0; height: 0; }");
    expect(chips).not.toContain("flex-wrap: wrap");
    expect(chips).not.toContain("Suggested");
    expect(chips).toContain("color: #a8a29e");
    expect(chips).toContain("color: #78716c");
    expect(chips).toContain("box-shadow: none");
    expect(chips).not.toContain("text-shadow");
    expect(chips).toContain("padding: 0 14px 12px");
    expect(chips).not.toContain("18px + .55rem");
    expect(chips).toContain("--chip-fade: 28px");
    expect(chips).toContain("gap: .3rem");
    expect(chips).toContain("padding: .2rem .5rem");
    expect(chips).toContain(".search-suggest-chips.is-fade-right");
    expect(chips).toContain(".search-suggest-chips.is-fade-left.is-fade-right");
    expect(chips).toContain("mask-image: linear-gradient");
    expect(source).toContain("function syncChipFades");
    expect(source).toContain('classList.toggle("is-fade-left"');
    expect(source).toContain('classList.toggle("is-fade-right"');
    const sheet = css.slice(css.indexOf("@media (max-width: 640px)"), css.indexOf(".section-head {"));
    expect(sheet).toContain(".search-suggest-chips");
    expect(sheet).toContain("flex-wrap: nowrap");
    expect(sheet).toContain("overflow-x: auto");
    expect(sheet).toContain("scrollbar-width: none");
    expect(sheet).toContain(".search-suggest-chips::-webkit-scrollbar { display: none; width: 0; height: 0; }");
    expect(sheet).toContain("calc(14px + env(safe-area-inset-left, 0px));");
    expect(sheet).not.toContain("18px + .55rem");
  });

  test("Hidden Arrow results mark query words, including a light stem, or the upstream spans", () => {
    const source = jumpScript();
    const start = source.indexOf("function stemLight");
    const end = source.indexOf("function render(state)");
    const api = new Function(
      `function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
      ${source.slice(start, end)}; return { highlightQuery, highlightFromHiddenArrow, stemLight };`,
    )() as {
      highlightQuery: (text: string, query: string) => string;
      highlightFromHiddenArrow: (item: Record<string, unknown>) => string;
      stemLight: (word: string) => string;
    };
    expect(api.stemLight("lives")).toBe(api.stemLight("life"));
    expect(api.stemLight("trees")).toBe(api.stemLight("tree"));
    const deut =
      "so that you and your children and grandchildren may fear the LORD your God all the days of your lives by keeping all His statutes";
    const deutHtml = api.highlightQuery(deut, "tree of life");
    expect(deutHtml).toContain('<mark class="search-mark">lives</mark>');
    expect(deutHtml).not.toContain(">of<");
    expect(deutHtml).not.toContain(">your<");
    const garden = "were the tree of life and the tree of the knowledge";
    const gardenHtml = api.highlightQuery(garden, "tree of life");
    expect(gardenHtml).toContain('<mark class="search-mark">tree</mark>');
    expect(gardenHtml).toContain('<mark class="search-mark">life</mark>');
    expect(gardenHtml).not.toContain('<mark class="search-mark">of</mark>');
    expect(api.highlightQuery("the street was quiet", "tree")).not.toContain("search-mark");
    const livesAt = deut.indexOf("lives");
    const fromOffsets = api.highlightFromHiddenArrow({
      text: deut,
      highlights: [{ start: livesAt, end: livesAt + "lives".length }],
    });
    expect(fromOffsets).toContain('<mark class="search-mark">lives</mark>');
    expect(fromOffsets).not.toContain("<script");
    const fromTags = api.highlightFromHiddenArrow({
      text: garden,
      highlight: "were the <em>tree</em> of <mark>life</mark> and the tree",
    });
    expect(fromTags).toContain('<mark class="search-mark">tree</mark>');
    expect(fromTags).toContain('<mark class="search-mark">life</mark>');
    expect(fromTags).toContain("knowledge");
    expect(fromTags).not.toContain("<em>");
    const exact = api.highlightFromHiddenArrow({ text: garden, matches: ["life"] });
    expect(exact).toContain('<mark class="search-mark">life</mark>');
    expect(exact).not.toContain('<mark class="search-mark">tree</mark>');
    expect(api.highlightFromHiddenArrow({ text: deut })).toBe("");
    expect(source).toContain("highlightFromHiddenArrow(item)");
    expect(source).toContain("hit.html ? hit.html : highlightQuery(hit.text, submittedQuery)");
    const mark = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const rule = mark.slice(mark.indexOf(".search-mark {"), mark.indexOf("html.search-modal-open"));
    expect(rule).toContain("color: #ea580c");
    expect(rule).toContain("color: #fb923c");
    expect(rule).toContain("font-weight: 600");
    expect(rule).not.toContain("text-shadow");
  });
});

describe("testament filter", () => {
  test("book paths split at Matthew and unknown paths stay out of a single testament", () => {
    expect(marginPathInTestament("/gen.2.9", "all")).toBe(true);
    expect(marginPathInTestament("/gen.2.9", "ot")).toBe(true);
    expect(marginPathInTestament("/mal.4.2", "ot")).toBe(true);
    expect(marginPathInTestament("/mat.1.1", "ot")).toBe(false);
    expect(marginPathInTestament("/jhn.3.16", "nt")).toBe(true);
    expect(marginPathInTestament("/gen.1.1", "nt")).toBe(false);
    expect(marginPathInTestament("/not.a.book", "nt")).toBe(false);
    expect(testamentCodes().nt[0]).toBe("MAT");
    expect(testamentCodes().ot.at(-1)).toBe("MAL");
  });

  test("the search bar picker is All / NT / OT and a change reruns only a submitted scripture query", () => {
    const source = jumpScript();
    expect(source).toContain('["all", "All"]');
    expect(source).toContain('["nt", "NT"]');
    expect(source).toContain('["ot", "OT"]');
    expect(source).toContain('sheetLabel.textContent = "Testament:"');
    expect(source).toContain('aria-label", "Testament options"');
    expect(source).toContain("search-testament-more");
    expect(source).toContain("search-testament-menu");
    expect(source).not.toContain("search-modal-translation");
    expect(source).toContain(JSON.stringify(testamentCodes().ot.map((code) => code.toLowerCase())));
    expect(source).toContain(JSON.stringify(testamentCodes().nt.map((code) => code.toLowerCase())));
    const search = source.slice(source.indexOf("async function searchScripture"), source.indexOf("async function suggestNow"));
    expect(search).toContain("JSON.stringify({ query: q })");
    expect(search).not.toContain("testament");
    expect(search.match(/fetch\("\/api\/ha-search"/g)?.length).toBe(1);
    const rerun = source.slice(source.indexOf("function rerunScriptureSearch"), source.indexOf("function chooseTestament"));
    expect(rerun.indexOf("q !== submittedQuery")).toBeLessThan(rerun.indexOf("searchScripture(q, my)"));
    expect(rerun).toContain("!scriptureSearchActive");
    expect(rerun.match(/searchScripture\(/g)?.length).toBe(1);
    expect(source).toContain('url.searchParams.set("testament", searchTestament)');
    expect(source).toContain('url.searchParams.delete("testament")');
    expect(source).toContain("scripture: Boolean(scripture)");
    const hits = source.slice(source.indexOf("function scriptureHits"), source.indexOf("function readRecentSearches"));
    expect(hits).toContain("keepScripture(path)");
    const books = source.slice(source.indexOf("function scriptureBook"), source.indexOf("function rerunScriptureSearch"));
    const api = new Function(
      `const OT_BOOKS = ${JSON.stringify(testamentCodes().ot.map((code) => code.toLowerCase()))};
       const NT_BOOKS = ${JSON.stringify(testamentCodes().nt.map((code) => code.toLowerCase()))};
       let searchTestament = "all";
       ${books}
       return { keep(path, testament) { searchTestament = testament; return keepScripture(path); } };`,
    )() as { keep: (path: string, testament: string) => boolean };
    expect(api.keep("/gen.2.9", "ot")).toBe(true);
    expect(api.keep("/jhn.3.16", "ot")).toBe(false);
    expect(api.keep("/jhn.3.16", "nt")).toBe(true);
    expect(api.keep("/gen.2.9", "all")).toBe(true);
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const picker = css.slice(css.indexOf(".search-testament {"), css.indexOf(".search-fab { display: none; }"));
    expect(picker).toContain("font-size: .75rem");
    expect(picker).toContain("font-weight: 500");
    expect(picker).toContain("border: 0");
    expect(picker).toContain("border-radius: .25rem");
    expect(picker).toContain("padding: .125rem 1.75rem .125rem .375rem");
    expect(picker).toContain("background-color: #fafaf9");
    expect(picker).toContain("color: #44403c");
    expect(picker).toContain("background-color: #1b1917");
    expect(picker).toContain("color: #d6d3d1");
    expect(picker).toContain("background-size: 1.25em 1.25em");
    expect(picker).toContain("stroke='%236b7280'");
    expect(picker).toContain("stroke='%23a8a29e'");
    expect(picker).toContain("appearance: none");
    const sheet = css.slice(css.indexOf("@media (max-width: 640px)"), css.indexOf(".section-head {"));
    expect(sheet).toContain(".search-testament-desktop { display: none; }");
    expect(sheet).toContain(".search-testament-more { display: inline-flex; }");
    expect(sheet).toContain(".search-testament-sheet-label");
    expect(sheet).toContain("background: #f5f5f4");
    expect(sheet).toContain("background: #292524");
    expect(sheet).toContain("border: 1px solid #e7e5e4");
  });
});

describe("passage helpers while typing", () => {
  test("book, chapter, and verse suggestions stay on jump-suggest and free text still waits for submit", () => {
    const source = jumpScript();
    const modal = source.slice(source.indexOf("function ensureSearchModal"), source.indexOf("function ensureSearchFab"));
    const onInput = modal.slice(modal.indexOf('input.addEventListener("input"'), modal.indexOf("topicChips.addEventListener"));
    const typing = onInput.slice(0, onInput.indexOf("if (timer)"));
    expect(typing).toContain("hideTopicChips()");
    expect(typing).toContain("suggest()");
    expect(typing).not.toContain("searchScripture");
    expect(typing).not.toContain("/api/ha-search");
    expect(typing).not.toContain("writeSearchCache");
    expect(onInput).toContain("suggestSeq += 1");
    expect(onInput).toContain("seq += 1");
    expect(onInput).toContain("close()");
    expect(onInput).toContain("loadTopicSuggestions()");
    expect(onInput).not.toContain("fetch(");
    expect(onInput).not.toContain("clearSearchCache");

    const live = source.slice(source.indexOf("async function suggestNow"), source.indexOf("async function submitJump"));
    expect(live).toContain('fetch("/api/jump-suggest?q="');
    expect(live).toContain("render(data)");
    expect(live).toContain("if (showingPassageHelpers()) close()");
    expect(live).not.toContain("/api/ha-search");
    expect(live).not.toContain("searchScripture");
    expect(live).not.toContain("writeSearchCache");
    expect(live).not.toContain("showSearchSkeletons");
    expect(live.indexOf("my !== suggestSeq || searchSeq !== seq")).toBeLessThan(live.indexOf("render(data)"));

    const keys = modal.slice(modal.indexOf('input.addEventListener("keydown"'), modal.indexOf('input.addEventListener("input"'));
    expect(keys).toContain('event.key === "Tab"');
    expect(keys).toContain("passageHit(hits[selected])");
    expect(keys.indexOf("applyHit(passage)")).toBeLessThan(keys.indexOf("q === submittedQuery"));

    const submit = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    expect(submit.indexOf("suggestSeq += 1")).toBeLessThan(submit.indexOf('fetch("/api/jump-suggest?q="'));
    expect(submit.indexOf("showSearchSkeletons()")).toBeLessThan(submit.indexOf("searchScripture(q, my)"));
    const freeText = submit.slice(submit.lastIndexOf("submittedQuery = q"));
    expect(freeText).toContain("searchScripture(q, my)");
    expect(freeText).not.toContain('fetch("/api/jump-suggest');

    expect(source).toContain("search-result-passage");
    expect(source).toContain('kind === "book" || kind === "chapter" || kind === "verse"');
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const passage = css.slice(css.indexOf(".search-result-passage {"), css.indexOf(".search-mark {"));
    expect(passage).toContain("font-size: .92rem");
    expect(passage).not.toContain("text-transform");
    expect(css).toContain(".search-modal-form:has(.search-modal-list.is-passage) .search-modal-footer { display: none; }");
    expect(css).toContain(".search-modal-list .suggest-hint");
  });
});

describe("recent query history", () => {
  test("an empty modal lists margin-recent-searches and a tap submits that query", () => {
    const source = jumpScript();
    expect(source).toContain('localStorage.getItem("margin-recent-searches")');
    expect(source).toContain('localStorage.setItem("margin-recent-searches"');
    expect(source).not.toContain("margin-query-history");
    expect(source).not.toContain("margin-search-history");
    expect(source).toContain('textContent = "Recent"');
    expect(source).not.toContain('textContent = "Suggested"');
    expect(source).not.toContain("search-suggest-label");
    const paint = source.slice(source.indexOf("function paintHistory"), source.indexOf("function syncChipFades"));
    expect(paint).toContain("readRecentSearches()");
    expect(paint).toContain('btn.setAttribute("data-query", query)');
    expect(paint).toContain("search-suggest-chip");
    expect(paint).toContain("btn.textContent = query");
    const load = source.slice(source.indexOf("async function loadTopicSuggestions"), source.indexOf("async function searchScripture"));
    expect(load.indexOf("paintHistory()")).toBeLessThan(load.indexOf("recent.length < 2"));
    expect(load.indexOf("recent.length < 2")).toBeLessThan(load.indexOf('fetch("/api/ha-suggest"'));
    const inputAt = source.indexOf('input.addEventListener("input"');
    const typing = source.slice(inputAt, source.indexOf("if (timer)", inputAt));
    expect(typing).toContain("hideHistory()");
    expect(typing).not.toContain("fetch(");
    expect(typing).not.toContain("/api/ha-search");
    const submitChip = source.slice(source.indexOf("function submitChip"), source.indexOf('topicChips.addEventListener("click"'));
    expect(submitChip).toContain("submitJump(q)");
    expect(submitChip).toContain("hideHistory()");
    expect(submitChip).not.toContain("/api/ha-search");
    const remembered = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    const passage = remembered.slice(0, remembered.indexOf("if ((data.hits"));
    expect(passage).not.toContain("rememberRecentSearch");
    const freeText = remembered.slice(remembered.lastIndexOf("submittedQuery = q"));
    expect(freeText.indexOf("rememberRecentSearch(q)")).toBeLessThan(freeText.indexOf("searchScripture(q, my)"));
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const history = css.slice(css.indexOf(".search-history {"), css.indexOf(".search-suggest {"));
    expect(history).toContain("padding: 0 14px 12px");
    expect(history).toContain(".search-history[hidden] { display: none; }");
    expect(history).toContain(".search-history-label");
    expect(history).not.toContain("Suggested");
    const sheet = css.slice(css.indexOf("@media (max-width: 640px)"), css.indexOf(".section-head {"));
    expect(sheet).toContain(".search-history,");
    expect(sheet).toContain("calc(14px + env(safe-area-inset-left, 0px));");
  });
});

describe("touch result selection", () => {
  test("the selected row background is only for a fine pointer that can hover", () => {
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const block = css.slice(css.indexOf(".search-result {"), css.indexOf(".search-result-ref {"));
    const fine = block.slice(block.indexOf("@media (hover: hover) and (pointer: fine)"));
    expect(fine).toContain(".search-result.is-selected");
    expect(fine).toContain(".search-result:hover");
    expect(fine).toContain(".search-result:focus-visible");
    expect(fine).toContain("background: color-mix(in srgb, var(--ink) 8%, var(--paper-raised))");
    const beforeFine = block.slice(0, block.indexOf("@media (hover: hover) and (pointer: fine)"));
    expect(beforeFine).not.toContain("background: color-mix(in srgb, var(--ink) 8%, var(--paper-raised))");
    expect(block).toContain(".search-result:active");
    expect(block.indexOf(".search-result:active")).toBeGreaterThan(block.indexOf("@media (hover: hover) and (pointer: fine)"));
  });
});

describe("POST /api/ha-suggest", () => {
  test("the upstream url prefers the suggest base, then the shared base, then the search origin", () => {
    expect(hiddenArrowSuggestUrl({ suggestBase: "https://suggest.arrow.test/", base: "https://base.arrow.test" })).toBe(
      "https://suggest.arrow.test/api/suggest-topics",
    );
    expect(hiddenArrowSuggestUrl({ base: "https://base.arrow.test/root/" })).toBe(
      "https://base.arrow.test/root/api/suggest-topics",
    );
    expect(hiddenArrowSuggestUrl({ origin: "https://preview.arrow.test/ignored" })).toBe(
      "https://preview.arrow.test/api/suggest-topics",
    );
    expect(hiddenArrowSuggestUrl()).toBe(`${HIDDEN_ARROW_ORIGIN}/api/suggest-topics`);
    expect(normalizeRecentSearches([" Tree ", "tree", "love", 4, "", "love"])).toEqual(["Tree", "love"]);
  });

  test("same-origin route forwards {recent} with the search key and does not require a session", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          topics: [{ label: "The tree", query: "tree of life", why: "test-search-key" }],
        }),
        { status: 200, headers: { "content-type": "application/json", "x-api-key": "test-search-key" } },
      );
    }) as typeof fetch;
    try {
      const env = {
        HIDDEN_ARROW_SUGGEST_BASE_URL: "https://suggest.arrow.test/",
        HIDDEN_ARROW_BASE_URL: "https://base.arrow.test",
        HIDDEN_ARROW_SEARCH_KEY: "test-search-key",
      } as Env;
      const recent = ["tree of life", "love", "tree of life", "a", "b", "c", "d", "e", "f", "g", "h", "i"];
      const res = await app.request(
        "http://margin.test/api/ha-suggest",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recent }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-api-key")).toBeNull();
      expect(res.headers.get("set-cookie")).toBeNull();
      const raw = JSON.stringify(await res.json());
      expect(raw).not.toContain("test-search-key");
      expect(raw).toContain("The tree");
      expect(seen[0]?.url).toBe("https://suggest.arrow.test/api/suggest-topics");
      expect(JSON.parse(String(seen[0]?.init.body))).toEqual({
        recent: ["tree of life", "love", "a", "b", "c", "d", "e", "f", "g", "h"],
      });
      expect(new Headers(seen[0]?.init.headers).get("x-api-key")).toBe("test-search-key");
    } finally {
      globalThis.fetch = real;
    }
  });

  test("a missing endpoint is forwarded as 404 and a missing key never calls upstream", async () => {
    let called = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
    try {
      const missing = await proxyHiddenArrowSuggest(["tree of life", "love"], { apiKey: "test-search-key" });
      expect(called).toBe(1);
      expect(missing.status).toBe(404);
      expect(missing.headers.get("x-api-key")).toBeNull();
      expect(await missing.json()).toEqual({ topics: [] });

      const unset = await app.request(
        "http://margin.test/api/ha-suggest",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recent: ["tree of life", "love"] }),
        },
        {} as Env,
      );
      expect(called).toBe(1);
      expect(unset.status).toBe(503);
      expect(unset.headers.get("x-api-key")).toBeNull();
      expect(await unset.json()).toEqual({ ok: false, error: "Scripture search is not configured." });
    } finally {
      globalThis.fetch = real;
    }
  });
});
