/**
 * Same-origin proxy for Hidden Arrow search.
 * The browser posts here. The worker forwards {"query"} and adds x-api-key
 * from HIDDEN_ARROW_SEARCH_KEY. That value is never written into the response.
 * If the key is unset, Hidden Arrow is not called.
 * Passage hrefs stay route.bible pathnames; Margin opens them on its own reader route.
 */
import { parsePassage, passageSlug } from "./passage";

export const HIDDEN_ARROW_ORIGIN = "https://hidden-arrow.up.railway.app";

export type HiddenArrowSearchRequest = {
  url: string;
  method: "POST";
  body: string;
};

export function hiddenArrowOrigin(override?: string | null): string {
  const raw = String(override ?? "").trim();
  if (!raw) return HIDDEN_ARROW_ORIGIN;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return HIDDEN_ARROW_ORIGIN;
    return url.origin;
  } catch {
    return HIDDEN_ARROW_ORIGIN;
  }
}

/**
 * Upstream request shape. Only the trimmed query is forwarded.
 * POST /api/search has no testament or scope field (an unauthenticated call
 * returns {"error":"Unauthorized."} and no schema). Margin keeps All / NT / OT
 * in the browser and drops hits whose book is outside that testament.
 */
export function hiddenArrowSearchRequest(query: string, origin?: string | null): HiddenArrowSearchRequest {
  return {
    url: `${hiddenArrowOrigin(origin)}/api/search`,
    method: "POST",
    body: JSON.stringify({ query: query.trim() }),
  };
}

/**
 * route.bible passage href → Margin reader path.
 * `https://route.bible/mrk.12.31?src=hidden-arrow` → `/mrk.12.31`.
 * The pathname is the canonical ref. Hosts other than route.bible are ignored.
 */
export function marginPathFromRouteHref(href: string | null | undefined): string | null {
  if (href == null) return null;
  const raw = String(href).trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "route.bible") return null;
  let slug = "";
  try {
    slug = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "").toLowerCase();
  } catch {
    return null;
  }
  if (!/^(?:[1-3][a-z]{2}|[a-z]{2,3})\.\d+(?:\.\d+(?:-\d+)?)?$/.test(slug)) return null;
  const passage = parsePassage(slug);
  if (!passage) return null;
  if (passageSlug(passage) !== slug) return null;
  return `/${slug}`;
}

/** Free text, and only after submit. A resolved reference, book/chapter hit, or chapter hint stays on jump. */
export function shouldQueryHiddenArrow(input: {
  query: string;
  hits: readonly unknown[];
  hint: string | null;
  canGo: boolean;
}): boolean {
  if (!String(input.query || "").trim()) return false;
  if (input.canGo) return false;
  if (input.hits.length > 0) return false;
  if (input.hint) return false;
  return true;
}

const NO_STORE = { "cache-control": "no-store" };

export type HiddenArrowSuggestOptions = {
  suggestBase?: string | null;
  base?: string | null;
  origin?: string | null;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
};

function usableSuggestBase(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** Newest-first, case-insensitive, at most 10 non-empty strings. */
export function normalizeRecentSearches(recent: unknown): string[] {
  if (!Array.isArray(recent)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of recent) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 400) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Suggest topics live on the same host as search unless a base URL is set.
 * HIDDEN_ARROW_SUGGEST_BASE_URL wins, then HIDDEN_ARROW_BASE_URL, then the search origin.
 */
export function hiddenArrowSuggestUrl(options: HiddenArrowSuggestOptions = {}): string {
  const explicit = usableSuggestBase(options.suggestBase) || usableSuggestBase(options.base);
  const root = explicit || hiddenArrowOrigin(options.origin);
  return `${root}/api/suggest-topics`;
}

export async function proxyHiddenArrowSuggest(
  recent: unknown,
  options: HiddenArrowSuggestOptions = {},
): Promise<Response> {
  if (!Array.isArray(recent)) {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const list = normalizeRecentSearches(recent);
  if (!list.length) {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const apiKey = String(options.apiKey ?? "").trim();
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Scripture search is not configured." },
      { status: 503, headers: NO_STORE },
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const upstream = await fetchImpl(hiddenArrowSuggestUrl(options), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ recent: list }),
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 404) {
      return Response.json({ topics: [] }, { status: 404, headers: NO_STORE });
    }
    const text = await upstream.text();
    if (!upstream.ok) return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.split(apiKey).join(""));
    } catch {
      return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
    }
    const response = Response.json(parsed, { status: 200, headers: NO_STORE });
    if (response.headers.get("x-api-key")) response.headers.delete("x-api-key");
    return response;
  } catch {
    return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
  }
}

export async function proxyHiddenArrowSearch(
  query: string,
  options: { origin?: string | null; apiKey?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const trimmed = String(query ?? "").trim();
  if (!trimmed || trimmed.length > 400) {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const apiKey = String(options.apiKey ?? "").trim();
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Scripture search is not configured." },
      { status: 503, headers: NO_STORE },
    );
  }
  const request = hiddenArrowSearchRequest(trimmed, options.origin);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const upstream = await fetchImpl(request.url, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": apiKey,
      },
      body: request.body,
      signal: AbortSignal.timeout(8000),
    });
    const text = await upstream.text();
    if (!upstream.ok) return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.split(apiKey).join(""));
    } catch {
      return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
    }
    const response = Response.json(parsed, { status: 200, headers: NO_STORE });
    if (response.headers.get("x-api-key")) response.headers.delete("x-api-key");
    return response;
  } catch {
    return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
  }
}
