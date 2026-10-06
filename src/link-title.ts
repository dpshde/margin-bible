/**
 * Page name for an external-ref chip. Open Graph, then Twitter, then <title>.
 * The hostname is the label when the page has no title or the fetch fails.
 */

const TITLE_LIMIT = 200;
const HTML_LIMIT = 48_000;
const FETCH_MS = 2_000;
const MAX_REDIRECTS = 4;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function publicHttpUrl(value: string): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || blockedHost(url.hostname)) return null;
  return url.toString();
}

export function pageTitleFromHtml(html: string): string | null {
  const og = metaContent(html, "og:title") || metaContent(html, "twitter:title");
  if (og) return clipTitle(og);
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  return clipTitle(decodeHtml(match[1]));
}

export async function resolveLinkTitle(
  raw: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ title: string; fallback: boolean }> {
  const url = publicHttpUrl(raw);
  const fallback = url ? hostnameLabel(url) : hostnameLabel(String(raw || ""));
  if (!url) return { title: fallback || String(raw || "").trim(), fallback: true };
  const html = await fetchHtml(url, fetchImpl);
  const title = html ? pageTitleFromHtml(html) : null;
  if (!title) return { title: fallback, fallback: true };
  return { title, fallback: false };
}

function clipTitle(value: string): string | null {
  const title = value.replace(/\s+/g, " ").trim().slice(0, TITLE_LIMIT);
  return title || null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeChar(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => safeChar(Number(num)))
    .replace(/&([a-z]+);/gi, (all, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? all);
}

function safeChar(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function metaContent(html: string, key: string): string | null {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const prop = (attr(tag, "property") || attr(tag, "name") || "").toLowerCase();
    if (prop !== key) continue;
    const content = attr(tag, "content");
    const title = content ? clipTitle(decodeHtml(content)) : null;
    if (title) return title;
  }
  return null;
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? null;
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal" || host.endsWith(".internal")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (host.includes(":")) {
    const bare = host.split("%")[0];
    if (bare === "::" || bare === "::1") return true;
    if (/^f[cd]/i.test(bare) || /^fe[89ab]/i.test(bare)) return true;
  }
  return false;
}

async function fetchHtml(start: string, fetchImpl: typeof fetch): Promise<string | null> {
  let current = start;
  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_MS);
    try {
      const response = await fetchImpl(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "user-agent": "Mozilla/5.0 (compatible; Margin/1.0)",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = publicHttpUrl(new URL(location, current).toString());
        if (!next) return null;
        current = next;
        continue;
      }
      if (!response.ok) return null;
      const type = response.headers.get("content-type") || "";
      if (type && !/html|xml/i.test(type)) return null;
      return await readPrefix(response, HTML_LIMIT);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function readPrefix(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, max);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    total += step.value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(total, max));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, buf.length - offset);
    if (take <= 0) break;
    buf.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return new TextDecoder().decode(buf);
}
