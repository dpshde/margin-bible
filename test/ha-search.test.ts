import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import app from "../src/index";
import type { Env } from "../src/index";
import {
  HIDDEN_ARROW_ORIGIN,
  hiddenArrowOrigin,
  hiddenArrowSearchRequest,
  marginPathFromRouteHref,
  proxyHiddenArrowSearch,
  shouldQueryHiddenArrow,
} from "../src/ha-search";
import { canGo, jumpState } from "../src/jump-suggest";
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
    expect(searching.indexOf("showSearchSkeletons()")).toBeLessThan(searching.indexOf('fetch("/api/ha-search"'));
    expect(searching).toContain("close()");
    expect(searching).not.toContain("Loading");
    const skeletons = source.slice(source.indexOf("function showSearchSkeletons"), source.indexOf("function render"));
    expect(skeletons).toContain("suggest-skeleton");
    expect(skeletons).toContain("suggest-skeleton-ref");
    expect(skeletons).toContain("suggest-skeleton-text");
    expect(skeletons).toContain("i < 4");
    expect(skeletons).toContain('aria-busy", "true"');
    const submit = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    expect(submit).toContain("searchScripture(q, my)");
    expect(submit).toContain('location.assign("/jump?q=" + encodeURIComponent(q))');
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
      fetchImpl,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(upstream);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe("https://arrow.test/api/search");
    expect(seen[0]?.init.method).toBe("POST");
    expect(new Headers(seen[0]?.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ query: "love your neighbor" });
  });

  test("a down upstream fails quietly", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const res = await proxyHiddenArrowSearch("love your neighbor", { fetchImpl });
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
      const res = await app.request("http://margin.test/api/ha-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: " love your neighbor " }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const data = await res.json();
      expect(data.query).toBe("love your neighbor");
      expect(seen[0]?.url).toBe(`${HIDDEN_ARROW_ORIGIN}/api/search`);
      expect(JSON.parse(String(seen[0]?.init.body))).toEqual({ query: "love your neighbor" });
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
      const env = { HIDDEN_ARROW_ORIGIN: "https://preview.arrow.test/nope" } as Env;
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
    } finally {
      globalThis.fetch = real;
    }
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
  });
});
