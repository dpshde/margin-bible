// Shipped into the page as source text. A compiled function's toString() can contain
// esbuild keep-names `__name(...)` calls, which the browser does not define.
import books from "../vendor/data/books.json";

export type PassageHelperHit = {
  kind: "book" | "chapter" | "verse" | "range";
  label: string;
  insertText: string;
};

export type PassageHelperState = {
  hits: PassageHelperHit[];
  hint: string | null;
  canGo: boolean;
};

const passageHelpersFunctionSource = `function passageHelpers(raw) {
  const data = PASSAGE_DATA;
  const codes = data.codes;
  const names = data.names;
  const chapters = data.chapterCounts;
  const verses = data.verseCounts;
  const aliases = data.aliases;

  function lookupKey(input) {
    return String(input || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function chapterCount(code) {
    return chapters[code] || 0;
  }
  function verseCount(code, chapter) {
    const row = verses[code];
    if (!row) return 0;
    return row[String(chapter)] || 0;
  }
  function resolveBook(token) {
    const key = lookupKey(token);
    if (!key) return null;
    if (aliases[key]) return aliases[key];
    const upper = key.toUpperCase();
    return names[upper] ? upper : null;
  }
  function positiveInt(value) {
    if (!/^\\d+$/.test(value)) return null;
    const parsed = parseInt(value, 10);
    if (!isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }
  function parseBookChapter(bookRaw, chapterRaw) {
    const book = resolveBook(bookRaw);
    if (!book) return null;
    const chapter = positiveInt(chapterRaw);
    if (!chapter || chapter > chapterCount(book)) return null;
    return { book: book, chapter: chapter };
  }
  function parseVerseContext(input) {
    const patterns = [
      /^(.+?)\\s+(\\d+)\\s*[:.]\\s*(\\d*)$/i,
      /^(.+?)\\s*[./]\\s*(\\d+)\\s*[:.]\\s*(\\d*)$/i,
      /^([1-3]?[a-zA-Z]+)(\\d+)\\s*[:.]\\s*(\\d*)$/i,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const match = input.match(patterns[i]);
      if (!match) continue;
      const parsed = parseBookChapter(match[1], match[2]);
      if (!parsed) continue;
      return { book: parsed.book, chapter: parsed.chapter, versePrefix: match[3] || "" };
    }
    return null;
  }
  function parseRangeContext(input) {
    const rangeMatch = input.match(/^(.*?)-\\s*(\\d*)$/);
    if (!rangeMatch) return null;
    const leftRaw = rangeMatch[1] ? String(rangeMatch[1]).trim() : "";
    const endPrefix = rangeMatch[2] || "";
    if (!leftRaw) return null;
    const left = parseVerseContext(leftRaw);
    if (!left || !left.versePrefix) return null;
    const startVerse = positiveInt(left.versePrefix);
    const maxVerse = verseCount(left.book, left.chapter);
    if (!startVerse || !maxVerse || startVerse > maxVerse) return null;
    if (endPrefix && positiveInt(endPrefix) === null) return null;
    return { book: left.book, chapter: left.chapter, startVerse: startVerse, endPrefix: endPrefix };
  }
  function parseChapterContext(input) {
    const patterns = [/^(.+?)\\s*[./]\\s*(\\d+)$/i, /^(.+?)\\s+(\\d+)$/i, /^([1-3]?[a-zA-Z]+)(\\d+)$/i];
    for (let i = 0; i < patterns.length; i++) {
      const match = input.match(patterns[i]);
      if (!match) continue;
      const parsed = parseBookChapter(match[1], match[2]);
      if (parsed) return parsed;
    }
    return null;
  }
  function hit(kind, label) {
    return { kind: kind, label: label, insertText: label };
  }
  function suggestBooks(key, limit) {
    const found = [];
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const display = names[code] || code;
      const nameKey = lookupKey(display);
      let score = Infinity;
      let shortest = Infinity;
      if (nameKey === key) {
        score = 0;
        shortest = nameKey.length;
      } else if (nameKey.indexOf(key) === 0) {
        score = 1;
        shortest = nameKey.length;
      } else {
        for (const alias in aliases) {
          if (aliases[alias] !== code || alias.indexOf(key) !== 0) continue;
          score = 2;
          if (alias.length < shortest) shortest = alias.length;
        }
        const codeKey = code.toLowerCase();
        if (codeKey.indexOf(key) === 0) {
          score = 2;
          if (codeKey.length < shortest) shortest = codeKey.length;
        }
      }
      if (score === Infinity) continue;
      found.push({ score: score, shortest: shortest, display: display });
    }
    found.sort(function (left, right) {
      if (left.score !== right.score) return left.score - right.score;
      if (left.shortest !== right.shortest) return left.shortest - right.shortest;
      return left.display.localeCompare(right.display);
    });
    const out = [];
    for (let i = 0; i < found.length && i < limit; i++) out.push(hit("book", found[i].display));
    return out;
  }
  function suggestVerses(context, limit) {
    const maxVerse = verseCount(context.book, context.chapter);
    if (!maxVerse) return [];
    const name = names[context.book] || context.book;
    const out = [];
    for (let verse = 1; verse <= maxVerse; verse++) {
      const verseText = String(verse);
      if (context.versePrefix && verseText.indexOf(context.versePrefix) !== 0) continue;
      out.push(hit("verse", name + " " + context.chapter + ":" + verseText));
      if (out.length >= limit) break;
    }
    return out;
  }
  function suggestRanges(context, limit) {
    const maxVerse = verseCount(context.book, context.chapter);
    if (!maxVerse) return [];
    const name = names[context.book] || context.book;
    const out = [];
    for (let verse = context.startVerse + 1; verse <= maxVerse; verse++) {
      const verseText = String(verse);
      if (context.endPrefix && verseText.indexOf(context.endPrefix) !== 0) continue;
      out.push(hit("range", name + " " + context.chapter + ":" + context.startVerse + "-" + verseText));
      if (out.length >= limit) break;
    }
    return out;
  }

  const normalized = String(raw || "").trim().replace(/[‐‑‒–—]/g, "-").replace(/\\s+/g, " ");
  let hits = [];
  if (normalized) {
    const range = parseRangeContext(normalized);
    if (range) hits = suggestRanges(range, 8);
    else {
      const verse = parseVerseContext(normalized);
      if (verse) hits = suggestVerses(verse, 8);
      else {
        const chapter = parseChapterContext(normalized);
        if (chapter) {
          const name = names[chapter.book] || chapter.book;
          hits = [hit("chapter", name + " " + chapter.chapter)];
        } else hits = suggestBooks(lookupKey(normalized), 8);
      }
    }
  }

  const bookOnly = lookupKey(normalized) && !/\\d/.test(normalized) ? resolveBook(normalized) : null;
  const rangeCtx = normalized ? parseRangeContext(normalized) : null;
  const verseCtx = !rangeCtx && normalized ? parseVerseContext(normalized) : null;
  const chapterCtx = !rangeCtx && !verseCtx && normalized ? parseChapterContext(normalized) : null;
  const contextBook = verseCtx ? verseCtx.book : chapterCtx ? chapterCtx.book : bookOnly;
  const contextChapter = verseCtx ? verseCtx.chapter : chapterCtx ? chapterCtx.chapter : 0;
  const contextVerse = verseCtx && verseCtx.versePrefix && positiveInt(verseCtx.versePrefix);

  const typed = String(raw || "").trim().toLowerCase();
  const visible = [];
  for (let i = 0; i < hits.length; i++) {
    const item = hits[i];
    const redundant = item.kind === "book" && contextBook && !contextChapter &&
      typed === String(item.insertText || "").trim().toLowerCase();
    if (!redundant) visible.push(item);
  }

  let hint = null;
  if (contextBook && !contextVerse) {
    if (contextChapter) {
      const count = verseCount(contextBook, contextChapter);
      if (count) hint = count === 1 ? "1 verse" : count + " verses";
    } else if (!visible.some(function (item) { return item.kind === "book"; })) {
      const count = chapterCount(contextBook);
      if (count) hint = count === 1 ? "1 chapter" : count + " chapters";
    }
  }

  let canGo = Boolean(contextChapter);
  if (rangeCtx) {
    if (!rangeCtx.endPrefix) canGo = true;
    else {
      const end = positiveInt(rangeCtx.endPrefix);
      const max = verseCount(rangeCtx.book, rangeCtx.chapter);
      canGo = Boolean(end && end > rangeCtx.startVerse && end <= max);
      if (canGo) {
        for (let verse = rangeCtx.startVerse + 1; verse <= max; verse++) {
          const text = String(verse);
          if (text !== rangeCtx.endPrefix && text.indexOf(rangeCtx.endPrefix) === 0) {
            canGo = false;
            break;
          }
        }
      }
    }
  }
  return { hits: visible, hint: hint, canGo: canGo };
}`;

/** Browser source for the search modal. Suggestions resolve against this data with no request. */
export function passageHelpersClientSource(): string {
  return `const PASSAGE_DATA = ${JSON.stringify(books)};
${passageHelpersFunctionSource}`;
}

type PassageHelpersFn = (raw: string | null | undefined) => PassageHelperState;

let passageHelpersFn: PassageHelpersFn | undefined;

function loadPassageHelpers(): PassageHelpersFn {
  if (!passageHelpersFn) {
    passageHelpersFn = new Function(`${passageHelpersClientSource()}
return passageHelpers;`)() as PassageHelpersFn;
  }
  return passageHelpersFn;
}

export function passageHelpers(raw: string | null | undefined): PassageHelperState {
  return loadPassageHelpers()(raw);
}
