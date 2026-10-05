/**
 * Same-origin proxy for Hidden Arrow search.
 * The browser posts here; the worker forwards {"query"} to the public
 * Hidden Arrow API and returns that JSON with no-store. No secret.
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

/** Upstream request shape. Only the trimmed query is forwarded. */
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

export async function proxyHiddenArrowSearch(
  query: string,
  options: { origin?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const trimmed = String(query ?? "").trim();
  if (!trimmed || trimmed.length > 400) {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const request = hiddenArrowSearchRequest(trimmed, options.origin);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const upstream = await fetchImpl(request.url, {
      method: request.method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: request.body,
      signal: AbortSignal.timeout(8000),
    });
    const text = await upstream.text();
    if (!upstream.ok) return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
    }
    return Response.json(parsed, { status: 200, headers: NO_STORE });
  } catch {
    return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
  }
}
