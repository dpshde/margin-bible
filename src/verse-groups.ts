/**
 * User-created verse webs.
 *
 * A hub surfaces when ≥2 notes point at it (manual xref fan-in) or one note
 * points at ≥2 verses (star). Title and description are optional names for
 * that mesh. This is not a curated pack, not a Hidden Arrow story, and not
 * a route.bible collection.
 *
 * TODO(pair): let someone drop a member from the web without deleting the xref.
 * TODO(pair): the key is the hub slug only. A second mesh on the same hub shares one title.
 * TODO(pair): include verse_groups rows in the library snapshot.
 * TODO(pair): stack more than the last cross-link add on undo.
 */
import { addAttachment, parseAttachmentInput, type Attachment } from "./attachments";
import { parsePassage, passageSlug } from "./passage";
import { slugLabel } from "./xref";

export const FAN_IN_MIN = 2;
export const STAR_MIN = 2;
export const PAIR_FILL_CAP = 48;
export const GROUP_TITLE_MAX = 120;
export const GROUP_DESCRIPTION_MAX = 2_000;

/** Fixture slugs from the promote packet. Detection tests use these. They are not shown as a product sample. */
export const DEMO_HUB = "rom.9.17";
export const DEMO_SPOKE_SLUGS = ["1pe.5.6", "est.4.14", "jhn.9.3", "rom.12.3"] as const;

export type GroupNote = {
  slug: string;
  attachments?: readonly Attachment[] | null;
};

export type UserEdge = { origin: string; target: string };

export type VersePair = {
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
};

export type VerseGroupTrigger = "fan-in" | "star" | "both";

export type VerseGroupMeta = {
  hub: string;
  title: string;
  description: string;
  undoPairs: { from: string; to: string }[];
  /** Member marked as the one star. Empty means no star. */
  star?: string;
};

export type VerseGroupMember = {
  slug: string;
  label: string;
  role: "hub" | "member";
  /** Place in the unstarred order, so clearing a star can put the chip back. */
  order?: number;
};

export type VerseGroupView = {
  hub: string;
  hubLabel: string;
  /** The starred member, or empty when the group has no star. */
  star: string;
  title: string;
  description: string;
  members: VerseGroupMember[];
  trigger: VerseGroupTrigger;
  inboundCount: number;
  outboundCount: number;
  why: string;
  sample: boolean;
  /** Seed hub from the promote packet, real or sample. */
  seed: boolean;
  missingPairs: VersePair[];
  missingCount: number;
  undoReady: boolean;
  /** Local keyword guess. A caption until the web has a saved title. Not a Jev result. */
  suggestedTitle?: string;
  /** Parent id for that guess, so the picker can open on the right branch. */
  topicParent?: string;
};

const DEMO_ORDER = new Map<string, number>(DEMO_SPOKE_SLUGS.map((slug, index) => [slug, index]));

export function canonSlug(slug: string | null | undefined): string | null {
  const passage = parsePassage(slug);
  if (!passage) return null;
  return passageSlug(passage);
}

export function cleanGroupTitle(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, GROUP_TITLE_MAX);
}

/** A verse-group chip is a passage, same as an xref attachment. URLs are not members. */
export function verseMemberFromInput(raw: unknown): { ok: true; slug: string; label: string } | { ok: false; error: string } {
  const parsed = parseAttachmentInput(raw);
  if (!parsed || parsed.kind !== "xref") return { ok: false, error: "Need a passage." };
  const slug = canonSlug(parsed.slug);
  if (!slug) return { ok: false, error: "Need a passage." };
  return { ok: true, slug, label: slugLabel(slug) };
}

export function cleanGroupDescription(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, GROUP_DESCRIPTION_MAX);
}

export function isUserXref(row: Attachment): row is Extract<Attachment, { kind: "xref" }> {
  return row.kind === "xref" && row.source !== "backlink";
}

/** Manual and scanned chips. Backlink mirrors are the other side of a link, not a second vote. */
export function userEdges(notes: readonly GroupNote[]): UserEdge[] {
  const edges: UserEdge[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    const origin = canonSlug(note.slug);
    if (!origin) continue;
    for (const row of note.attachments ?? []) {
      if (!isUserXref(row)) continue;
      const target = canonSlug(row.slug);
      if (!target || target === origin) continue;
      const key = `${origin}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ origin, target });
    }
  }
  return edges;
}

export function withManualXref(
  list: readonly Attachment[] | null | undefined,
  target: string,
  id: string,
): { list: Attachment[]; added: boolean } {
  const slug = canonSlug(target);
  if (!slug) return { list: [...(list ?? [])], added: false };
  const result = addAttachment(list ?? [], {
    id,
    kind: "xref",
    slug,
    title: slugLabel(slug),
    source: "manual",
  });
  return { list: result.list, added: Boolean(result.added) };
}

/** Drop a user-owned xref to `target`. Leave backlink mirrors in place for sync to clear. */
export function withoutUserXref(list: readonly Attachment[] | null | undefined, target: string): Attachment[] {
  const slug = canonSlug(target);
  return [...(list ?? [])].filter((row) => {
    if (row.kind !== "xref" || row.source === "backlink") return true;
    return canonSlug(row.slug) !== slug;
  });
}

/**
 * Missing unordered pairs among members. A one-way user xref counts as linked.
 * Direction is the lower slug → the higher slug so a preview is stable.
 * Does not add anything.
 */
export function missingPairwise(members: readonly string[], edges: readonly UserEdge[]): {
  pairs: VersePair[];
  total: number;
} {
  const slugs = uniqueSlugs(members);
  const linked = new Set(edges.map((edge) => `${edge.origin}->${edge.target}`));
  const all: VersePair[] = [];
  const ordered = [...slugs].sort();
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const left = ordered[i]!;
      const right = ordered[j]!;
      if (linked.has(`${left}->${right}`) || linked.has(`${right}->${left}`)) continue;
      const from = left < right ? left : right;
      const to = left < right ? right : left;
      all.push({ from, to, fromLabel: slugLabel(from), toLabel: slugLabel(to) });
    }
  }
  return { pairs: all.slice(0, PAIR_FILL_CAP), total: all.length };
}

/** Hubs that already exist in the notes. Empty when the library has no fan-in or star. */
export function realVerseGroups(notes: readonly GroupNote[], metas: readonly VerseGroupMeta[] = []): VerseGroupView[] {
  const edges = userEdges(notes);
  const inbound = new Map<string, Set<string>>();
  const outbound = new Map<string, Set<string>>();
  for (const edge of edges) {
    const into = inbound.get(edge.target) ?? new Set<string>();
    into.add(edge.origin);
    inbound.set(edge.target, into);
    const out = outbound.get(edge.origin) ?? new Set<string>();
    out.add(edge.target);
    outbound.set(edge.origin, out);
  }
  const hubs = new Set<string>();
  for (const [slug, origins] of inbound) {
    if (origins.size >= FAN_IN_MIN) hubs.add(slug);
  }
  for (const [slug, targets] of outbound) {
    if (targets.size >= STAR_MIN) hubs.add(slug);
  }
  const metaByHub = metaMap(metas);
  const groups = [...hubs].map((hub) => {
    const origins = inbound.get(hub) ?? new Set<string>();
    const targets = outbound.get(hub) ?? new Set<string>();
    const members = sortMembers(hub, [hub, ...origins, ...targets]);
    return toView({
      hub,
      edges,
      members,
      inboundCount: origins.size,
      outboundCount: targets.size,
      sample: false,
      meta: metaByHub.get(hub),
    });
  });
  groups.sort(compareGroups);
  return groups;
}

/** Hubs already in this library. Empty when there is no fan-in or star. */
export function verseGroupsFromNotes(
  notes: readonly GroupNote[],
  metas: readonly VerseGroupMeta[] = [],
): VerseGroupView[] {
  return realVerseGroups(notes, metas);
}

function toView(input: {
  hub: string;
  edges: readonly UserEdge[];
  members: readonly string[];
  inboundCount: number;
  outboundCount: number;
  sample: boolean;
  meta?: VerseGroupMeta;
}): VerseGroupView {
  const hubLabel = slugLabel(input.hub);
  const fanIn = input.inboundCount >= FAN_IN_MIN;
  const starTrigger = input.outboundCount >= STAR_MIN;
  const trigger: VerseGroupTrigger = fanIn && starTrigger ? "both" : fanIn ? "fan-in" : "star";
  const missing = missingPairwise(input.members, input.edges);
  const star = resolveStar(input.members, input.meta?.star);
  const natural = sortMembers(input.hub, input.members);
  const ordered = star ? [star, ...natural.filter((slug) => slug !== star)] : natural;
  const place = new Map(natural.map((slug, index) => [slug, index]));
  const members = ordered.map((slug) => ({
    slug,
    label: slugLabel(slug),
    role: slug === input.hub ? ("hub" as const) : ("member" as const),
    order: place.get(slug) ?? 0,
  }));
  return {
    hub: input.hub,
    hubLabel,
    star,
    title: input.meta?.title ?? "",
    description: input.meta?.description ?? "",
    members,
    trigger,
    inboundCount: input.inboundCount,
    outboundCount: input.outboundCount,
    why: whyText(trigger, input.inboundCount, input.outboundCount, hubLabel),
    sample: input.sample,
    seed: input.hub === DEMO_HUB,
    missingPairs: missing.pairs,
    missingCount: missing.total,
    undoReady: (input.meta?.undoPairs.length ?? 0) > 0,
  };
}

function whyText(trigger: VerseGroupTrigger, inboundCount: number, outboundCount: number, hubLabel: string): string {
  const pointed = inboundCount === 1 ? "1 note points" : `${inboundCount} notes point`;
  const spokes = outboundCount === 1 ? "1 verse" : `${outboundCount} verses`;
  if (trigger === "both") return `${pointed} at ${hubLabel}, and it points at ${spokes}.`;
  if (trigger === "fan-in") return `${pointed} at ${hubLabel}.`;
  return `This note points at ${spokes}.`;
}

function compareGroups(a: VerseGroupView, b: VerseGroupView): number {
  const named = Number(Boolean(b.title)) - Number(Boolean(a.title));
  if (named) return named;
  if (b.members.length !== a.members.length) return b.members.length - a.members.length;
  return a.hub < b.hub ? -1 : a.hub > b.hub ? 1 : 0;
}

function resolveStar(members: readonly string[], stored: string | undefined): string {
  const star = stored ? canonSlug(stored) : null;
  if (!star) return "";
  const known = new Set(members.map((slug) => canonSlug(slug) ?? slug));
  return known.has(star) ? star : "";
}

function sortMembers(first: string, slugs: readonly string[]): string[] {
  const rest = uniqueSlugs(slugs).filter((slug) => slug !== first);
  rest.sort((a, b) => {
    const ai = DEMO_ORDER.get(a) ?? 1_000;
    const bi = DEMO_ORDER.get(b) ?? 1_000;
    if (ai !== bi) return ai - bi;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return [first, ...rest];
}

function uniqueSlugs(slugs: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of slugs) {
    const slug = canonSlug(raw) ?? raw;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function metaMap(metas: readonly VerseGroupMeta[]): Map<string, VerseGroupMeta> {
  const map = new Map<string, VerseGroupMeta>();
  for (const meta of metas) {
    const hub = canonSlug(meta.hub);
    if (hub) map.set(hub, { ...meta, hub, star: canonSlug(meta.star) ?? "" });
  }
  return map;
}
