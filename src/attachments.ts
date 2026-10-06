/**
 * Note attachment chips: passage xref or http(s) weblink.
 * Inline wiki xrefs stay in block text; these live on the note itself.
 * Spike port of Rails Margin::Attachment + note-attachments.js.
 */
import { tryParseAnyPassage } from "grab-bcv";
import { hrefForXref, parseXrefHref, sameChapterSlug, slugLabel } from "./xref";
import { wikiTokens } from "./wiki-markup";

export type XrefAttachment = {
  id: string;
  kind: "xref";
  slug: string;
  title: string;
  source?: "manual" | "scan" | "backlink";
};
export type UrlAttachment = {
  id: string;
  kind: "url";
  url: string;
  title: string;
  source: "manual";
};
export type Attachment = XrefAttachment | UrlAttachment;

const ATT_ID = /^att_[A-Za-z0-9]{4,16}$/;

export { hrefForXref, parseXrefHref, sameChapterSlug, slugLabel, wikiTokens };
export type { WikiToken } from "./wiki-markup";
export { resolveWikiTarget, displayTokens, wikiRaw } from "./wiki-markup";

export function emptyAttachments(list: unknown): boolean {
  return normalizeAttachments(list).length === 0;
}

export function noteIsEmpty(blocks: Array<{ text?: string }>, attachments: unknown, bookmarked = false): boolean {
  if (bookmarked) return false;
  const noText = !Array.isArray(blocks) || blocks.every((block) => !String(block?.text || "").trim());
  return noText && emptyAttachments(attachments);
}

export function parseAttachmentInput(raw: unknown): Attachment | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  // An http(s) link is an external ref. A typed passage is still an xref.
  const url = absoluteHttpUrl(text);
  if (url) return { id: newAttachmentId(), kind: "url", url, title: urlTitle(url), source: "manual" };
  const passage = parsePassageValue(text);
  if (passage) return passage;
  return null;
}

export function normalizeAttachments(raw: unknown): Attachment[] {
  const rows = Array.isArray(raw) ? raw : parseJsonList(raw);
  const seen = new Set<string>();
  const out: Attachment[] = [];
  for (const row of rows) {
    const normalized = normalizeAttachment(row);
    if (!normalized) continue;
    const key = attachmentKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function addAttachment(
  list: unknown,
  incoming: unknown,
): { list: Attachment[]; added: Attachment | null } {
  const current = normalizeAttachments(list);
  const parsed =
    incoming && typeof incoming === "object" && "kind" in (incoming as object)
      ? normalizeAttachment(incoming)
      : taggedAttachment(parseAttachmentInput(incoming), incoming);
  if (!parsed) return { list: current, added: null };
  const key = attachmentKey(parsed);
  if (current.some((row) => attachmentKey(row) === key)) return { list: current, added: null };
  const next = normalizeAttachments([...current, parsed]);
  const added = next.find((row) => attachmentKey(row) === key) || null;
  return { list: next, added };
}

export function removeAttachment(list: unknown, id: string): Attachment[] {
  return normalizeAttachments(list).filter((row) => row.id !== id);
}

export function parsedXrefsFromBlocks(blocks: Array<{ text?: string } | string | null | undefined>): XrefAttachment[] {
  const found: XrefAttachment[] = [];
  const seen = new Set<string>();
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const text = typeof block === "string" ? block : block?.text || "";
    for (const token of wikiTokens(text)) {
      if (token.type !== "wiki" || !token.slug || seen.has(token.slug)) continue;
      seen.add(token.slug);
      found.push({
        id: newAttachmentId(),
        kind: "xref",
        slug: token.slug,
        title: slugLabel(token.slug),
      });
    }
  }
  return found;
}

export function mergeParsedXrefs(
  list: unknown,
  blocks: Array<{ text?: string } | string | null | undefined>,
  opts: { suppressScanSlugs?: Iterable<string> } = {},
): { list: Attachment[]; added: Attachment[]; changed: boolean } {
  const current = normalizeAttachments(list);
  const suppress = new Set(opts.suppressScanSlugs || []);
  const parsed = parsedXrefsFromBlocks(blocks);
  const parsedSlugs = new Set(parsed.map((row) => row.slug));
  const kept = current
    .filter((row) => keepAttachment(row, parsedSlugs))
    .map((row) => {
      if (row.kind !== "xref" || !parsedSlugs.has(row.slug)) return row;
      const title = parsed.find((item) => item.slug === row.slug)?.title || row.title;
      const source =
        row.source === "manual" || row.source === "backlink" ? row.source : ("scan" as const);
      if (title === row.title && row.source === source) return row;
      return { ...row, title, source };
    });
  const present = new Set(kept.filter((row) => row.kind === "xref").map((row) => row.slug));
  const added: Attachment[] = [];
  let next = kept;
  for (const xref of parsed) {
    if (present.has(xref.slug)) continue;
    // Client explicitly removed this chip on this save — do not resurrect from text.
    if (suppress.has(xref.slug)) continue;
    const result = addAttachment(next, { ...xref, source: "scan" });
    if (result.added) {
      added.push(result.added);
      present.add(xref.slug);
    }
    next = result.list;
  }
  return { list: next, added, changed: JSON.stringify(current) !== JSON.stringify(next) };
}

export function attachmentHref(row: Attachment): string {
  if (row.kind === "xref") return hrefForXref(row.slug);
  return row.url || "";
}

function taggedAttachment(parsed: Attachment | null, incoming: unknown): Attachment | null {
  if (!parsed) return null;
  const source =
    incoming && typeof incoming === "object" && "source" in (incoming as object)
      ? (incoming as { source?: string }).source
      : parsed.source;
  return withSource(parsed, source);
}

function keepAttachment(row: Attachment, parsedSlugs: Set<string>): boolean {
  if (row.kind !== "xref") return true;
  // Only scanned chips are tied to note text. Missing source = persisted/manual (legacy rows).
  if (row.source !== "scan") return true;
  return parsedSlugs.has(row.slug);
}

function attachmentKey(row: Attachment): string {
  return row.kind === "xref" ? `xref:${row.slug}` : `url:${row.url}`;
}

function normalizeAttachment(row: unknown): Attachment | null {
  if (!row || typeof row !== "object") return parseAttachmentInput(row);
  const record = row as Record<string, unknown>;
  if (record.kind === "xref" || record.slug) {
    const parsed = parsePassageValue(String(record.slug || record.title || ""));
    if (!parsed) return null;
    return withSource(
      {
        id: sanitizeId(record.id) || newAttachmentId(),
        kind: "xref",
        slug: parsed.slug,
        title: String(record.title || parsed.title),
      },
      record.source,
    );
  }
  if (record.kind === "url" || record.url) {
    const url = absoluteHttpUrl(String(record.url || record.href || ""));
    if (!url) return null;
    return withSource(
      {
        id: sanitizeId(record.id) || newAttachmentId(),
        kind: "url",
        url,
        title: String(record.title || urlTitle(url)),
        source: "manual",
      },
      "manual",
    );
  }
  return parseAttachmentInput(record.title || record.target || "");
}

function parsePassageValue(input: string): Extract<Attachment, { kind: "xref" }> | null {
  const text = String(input || "").trim();
  if (!text || !/\d/.test(text)) return null;
  const parsed = tryParseAnyPassage(text);
  if (!parsed.ok) return null;
  const value = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value;
  const slug = String(value?.canonical || "").toLowerCase();
  if (!slug) return null;
  return { id: newAttachmentId(), kind: "xref", slug, title: slugLabel(slug), source: "manual" };
}

function absoluteHttpUrl(value: string): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function urlTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function parseJsonList(raw: unknown): unknown[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeId(id: unknown): string | null {
  const value = String(id || "");
  return ATT_ID.test(value) ? value : null;
}

function withSource(row: Attachment, source: unknown): Attachment {
  if (row.kind === "url") return { ...row, source: "manual" };
  if (source === "manual" || source === "scan" || source === "backlink") return { ...row, source };
  return row;
}

export function newAttachmentId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `att_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
