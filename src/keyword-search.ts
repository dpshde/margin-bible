import { bookCodes, bookName, chapterCount } from "./books";

export type KeywordVerse = { path: string; label: string; text: string };

export type KeywordIndex = {
  verses: KeywordVerse[];
  postings: Map<string, number[]>;
};

/** Plain functions embedded in the page. One search path, no mode switch. */
export function keywordSearchClientSource(): string {
  return String.raw`function keywordTokens(query) {
  return String(query || "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
}
function keywordStop(token) {
  return token === "a" || token === "an" || token === "the" || token === "of" || token === "and" || token === "or" || token === "to" || token === "in" || token === "on" || token === "for" || token === "your" || token === "is" || token === "it" || token === "be" || token === "as";
}
function keywordEscapeReg(token) {
  let out = "";
  const special = ".*+?^\${}()|[]\\";
  for (const ch of String(token)) out += special.includes(ch) ? "\\" + ch : ch;
  return out;
}
function buildKeywordIndex(rows) {
  const verses = [];
  const postings = new Map();
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    const path = row && (row.path || row[0]);
    const label = row && (row.label || row[1]);
    const text = row && (row.text || row[2]);
    if (!path || !text) continue;
    const id = verses.length;
    verses.push({ path: String(path), label: String(label || path), text: String(text) });
    for (const token of new Set(keywordTokens(text))) {
      const bucket = postings.get(token);
      if (bucket) bucket.push(id);
      else postings.set(token, [id]);
    }
  }
  return { verses, postings };
}
function searchKeywordIndex(index, query, limit) {
  const cap = limit || 8;
  if (!index || !index.verses) return [];
  const raw = keywordTokens(query);
  const content = raw.filter((token) => !keywordStop(token));
  const used = content.length ? content : raw;
  if (!used.length) return [];
  const scores = new Map();
  for (const token of used) {
    const ids = index.postings.get(token);
    if (!ids) continue;
    for (const id of ids) scores.set(id, (scores.get(id) || 0) + 1);
  }
  const ranked = [];
  for (const [id, score] of scores) {
    if (score >= used.length) ranked.push(id);
  }
  const phrase = String(query || "").toLowerCase().replace(/\s+/g, " ").trim();
  ranked.sort((a, b) => {
    const left = index.verses[a];
    const right = index.verses[b];
    const leftPhrase = phrase && left.text.toLowerCase().includes(phrase) ? 1 : 0;
    const rightPhrase = phrase && right.text.toLowerCase().includes(phrase) ? 1 : 0;
    if (leftPhrase !== rightPhrase) return rightPhrase - leftPhrase;
    const delta = (scores.get(b) || 0) - (scores.get(a) || 0);
    if (delta) return delta;
    return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  });
  return ranked.slice(0, cap).map((id) => index.verses[id]);
}
function highlightQuery(text, query) {
  const raw = keywordTokens(query);
  const content = raw.filter((token) => !keywordStop(token));
  const used = content.length ? content : raw;
  const safe = String(text || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  if (!used.length) return safe;
  const pattern = used.map(keywordEscapeReg).join("|");
  return safe.replace(new RegExp("\\b(" + pattern + ")\\b", "gi"), (match) => '<mark class="search-mark">' + match + "</mark>");
}`;
}

type KeywordClient = {
  buildKeywordIndex: (rows: unknown) => KeywordIndex;
  searchKeywordIndex: (index: KeywordIndex, query: string, limit?: number) => KeywordVerse[];
};

export function loadKeywordSearch(): KeywordClient {
  return new Function(`${keywordSearchClientSource()}; return { buildKeywordIndex, searchKeywordIndex };`)() as KeywordClient;
}

export function keywordBookSpecs(): { code: string; name: string; chapters: number }[] {
  return bookCodes().map((code) => ({
    code,
    name: bookName(code) || code,
    chapters: chapterCount(code),
  }));
}

export async function collectKeywordVerses(
  specs: { code: string; name: string; chapters: number }[],
  load: (code: string, chapter: number) => Promise<{ verses: { v: number; text: string }[] } | null>,
): Promise<[string, string, string][]> {
  const jobs: { code: string; name: string; chapter: number }[] = [];
  for (const spec of specs) {
    for (let chapter = 1; chapter <= spec.chapters; chapter++) {
      jobs.push({ code: spec.code, name: spec.name, chapter });
    }
  }
  const out: [string, string, string][] = [];
  const batch = 32;
  for (let index = 0; index < jobs.length; index += batch) {
    const slice = jobs.slice(index, index + batch);
    const packs = await Promise.all(slice.map((job) => load(job.code, job.chapter)));
    slice.forEach((job, offset) => {
      const pack = packs[offset];
      if (!pack) return;
      for (const verse of pack.verses) {
        const text = String(verse.text || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        out.push([
          `/${job.code.toLowerCase()}.${job.chapter}.${verse.v}`,
          `${job.name} ${job.chapter}:${verse.v}`,
          text,
        ]);
      }
    });
  }
  return out;
}
