/**
 * BSB lines for verse-group members. Chapter JSON lives on the assets binding.
 */
import { parsePassage } from "./passage";
import { slugLabel } from "./xref";
import type { VerseLine } from "./jev";

type VerseRow = { v?: number; text?: string };

export type AssetFetch = {
  fetch(input: URL | RequestInfo): Promise<Response>;
};

export async function bsbLinesForSlugs(assets: AssetFetch, slugs: readonly string[]): Promise<VerseLine[]> {
  const chapters = new Map<string, VerseRow[] | null>();
  const lines: VerseLine[] = [];
  for (const slug of slugs) {
    const passage = parsePassage(slug);
    if (!passage || passage.verseStart == null) continue;
    const key = `${passage.book.toLowerCase()}.${passage.chapter}`;
    if (!chapters.has(key)) chapters.set(key, await loadVerses(assets, key));
    const verses = chapters.get(key);
    const row = verses?.find((verse) => verse.v === passage.verseStart);
    const text = typeof row?.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    lines.push({ label: slugLabel(slug), text });
  }
  return lines;
}

async function loadVerses(assets: AssetFetch, key: string): Promise<VerseRow[] | null> {
  const response = await assets.fetch(new URL(`/bsb/${key}.json`, "https://assets.local"));
  if (!response.ok) return null;
  const pack = (await response.json()) as { verses?: unknown };
  if (!pack || !Array.isArray(pack.verses)) return null;
  return pack.verses as VerseRow[];
}
