import {
  BOOK_ALIAS_TO_OSIS,
  OSIS_BOOK_CODES,
  OSIS_BOOK_NAMES,
  getBookOrder,
  getMaxChapter,
  getMaxVerse,
  isOsisBookCode,
  resolveBookAlias
} from "./chunk-DDWKUFQF.js";

// src/format.ts
function hasVerse(part) {
  return typeof part.verse === "number" && Number.isFinite(part.verse);
}
function formatPart(part, includeBook) {
  const bookName = OSIS_BOOK_NAMES[part.book] ?? part.book;
  const chapterVerse = hasVerse(part) ? `${part.chapter}:${part.verse}` : `${part.chapter}`;
  return includeBook ? `${bookName} ${chapterVerse}` : chapterVerse;
}
function formatPassageForDisplay(parsed) {
  const start = parsed.start;
  const end = parsed.end;
  const startHasVerse = hasVerse(start);
  const endHasVerse = hasVerse(end);
  const sameBook = start.book === end.book;
  const sameChapter = sameBook && start.chapter === end.chapter;
  const bookName = OSIS_BOOK_NAMES[start.book] ?? start.book;
  if (sameChapter && startHasVerse && endHasVerse && start.verse === end.verse) {
    return `${bookName} ${start.chapter}:${start.verse}`;
  }
  if (sameChapter && !startHasVerse && !endHasVerse) {
    return `${bookName} ${start.chapter}`;
  }
  if (sameChapter && startHasVerse && endHasVerse) {
    return `${bookName} ${start.chapter}:${start.verse}-${end.verse}`;
  }
  if (sameBook && !startHasVerse && !endHasVerse) {
    return `${bookName} ${start.chapter}-${end.chapter}`;
  }
  if (sameBook) {
    return `${bookName} ${formatPart(start, false)}-${formatPart(end, false)}`;
  }
  return `${formatPart(start, true)}-${formatPart(end, true)}`;
}

// src/types.ts
var PassageParseError = class extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.name = "PassageParseError";
    this.code = code;
    this.details = details;
  }
};

// src/normalize-intake.ts
var INVISIBLE_FORMATTING_REGEX = /[\u061C\u200B-\u200D\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
var FULL_WIDTH_PUNCTUATION_REGEX = /[：．／]/g;
var DASH_VARIANT_REGEX = /[‐‑‒–—―−﹘﹣－]/g;
function normalizeFullWidthPunctuation(value) {
  return value.replace(FULL_WIDTH_PUNCTUATION_REGEX, (character) => {
    switch (character) {
      case "\uFF1A":
        return ":";
      case "\uFF0E":
        return ".";
      case "\uFF0F":
        return "/";
      default:
        return character;
    }
  });
}
function normalizePassageIntakeText(input) {
  return normalizeFullWidthPunctuation(input.normalize("NFKC")).replace(INVISIBLE_FORMATTING_REGEX, "").replace(DASH_VARIANT_REGEX, "-");
}

// src/parser.ts
var FULL_REFERENCE_REGEX = /^([1-3]?[A-Z]{2,})\.(\d+)\.(\d+)$/;
var CHAPTER_REFERENCE_REGEX = /^([1-3]?[A-Z]{2,})\.(\d+)$/;
var PASSAGE_FORMAT_ERROR_MESSAGE = "Use references like JHN.3, JHN.3.16, John 3:16-18, or JHN.3.16-JHN.4.2.";
function normalizeToken(input) {
  return normalizePassageIntakeText(input).trim().replace(/\s+/g, "").replace(/:/g, ".").replace(/\.\.+/g, ".").toUpperCase();
}
function normalizeNaturalToken(input) {
  return normalizePassageIntakeText(input).trim().replace(/[,;]+/g, " ").replace(/\s+/g, " ");
}
function toPositiveIntegerOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
function toPositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PassageParseError("INVALID_NUMBER", "Chapter and verse must be positive integers.");
  }
  return parsed;
}
function hasVerse2(part) {
  return typeof part.verse === "number" && Number.isFinite(part.verse);
}
function formatPart2(part) {
  return hasVerse2(part) ? `${part.book}.${part.chapter}.${part.verse}` : `${part.book}.${part.chapter}`;
}
function formatBookName(book) {
  return OSIS_BOOK_NAMES[book] ?? book;
}
function chapterCapMessage(book, maxChapter) {
  return `${formatBookName(book)} has ${maxChapter} chapter${maxChapter === 1 ? "" : "s"}.`;
}
function verseCapMessage(book, chapter, maxVerse) {
  return `${formatBookName(book)} ${chapter} has ${maxVerse} verse${maxVerse === 1 ? "" : "s"}.`;
}
function createChapterCapDetails(book, maxChapter, attemptedChapter) {
  return {
    kind: "chapter_cap",
    book,
    bookName: formatBookName(book),
    maxChapter,
    attemptedChapter
  };
}
function createVerseCapDetails(book, chapter, maxVerse, attemptedVerse) {
  return {
    kind: "verse_cap",
    book,
    bookName: formatBookName(book),
    chapter,
    maxVerse,
    attemptedVerse
  };
}
function toAliasKey(input) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function isSingleInsertionAway(shorter, longer) {
  if (longer.length !== shorter.length + 1) {
    return false;
  }
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped) {
      return false;
    }
    skipped = true;
    j += 1;
  }
  return true;
}
function resolveChapterFallbackBookAlias(bookRaw, chapter, primaryBook) {
  const key = toAliasKey(bookRaw);
  if (!key || key.length < 3) {
    return null;
  }
  const byBook = /* @__PURE__ */ new Map();
  for (const [aliasKey, osis] of BOOK_ALIAS_TO_OSIS.entries()) {
    if (osis === primaryBook) {
      continue;
    }
    const isPrefixMatch = aliasKey.startsWith(key) || key.startsWith(aliasKey);
    const isOneEditExpandedMatch = aliasKey.length >= 4 && isSingleInsertionAway(key, aliasKey) && aliasKey.slice(0, 2) === key.slice(0, 2);
    if (!isPrefixMatch && !isOneEditExpandedMatch) {
      continue;
    }
    if (chapter > getMaxChapter(osis)) {
      continue;
    }
    const next = {
      book: osis,
      lengthDelta: Math.abs(aliasKey.length - key.length)
    };
    const existing = byBook.get(osis);
    if (!existing || next.lengthDelta < existing.lengthDelta) {
      byBook.set(osis, next);
    }
  }
  const ranked = Array.from(byBook.values()).sort((left, right) => left.lengthDelta - right.lengthDelta);
  const best = ranked[0];
  const second = ranked[1];
  if (!best) {
    return null;
  }
  if (second && second.lengthDelta === best.lengthDelta) {
    return null;
  }
  return best.book;
}
function parseReferenceToken(token) {
  const fullMatch = token.match(FULL_REFERENCE_REGEX);
  if (fullMatch) {
    const rawBook = fullMatch[1];
    const chapterText = fullMatch[2];
    const verseText = fullMatch[3];
    if (!rawBook || !chapterText || !verseText) {
      throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
    }
    const book = rawBook.toUpperCase();
    if (!isOsisBookCode(book)) {
      throw new PassageParseError("INVALID_BOOK", `Unknown book code: ${rawBook}.`);
    }
    const chapter = toPositiveInteger(chapterText);
    const maxChapter = getMaxChapter(book);
    if (chapter > maxChapter) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        chapterCapMessage(book, maxChapter),
        createChapterCapDetails(book, maxChapter, chapter)
      );
    }
    const verse = toPositiveInteger(verseText);
    const maxVerse = getMaxVerse(book, chapter);
    if (maxVerse !== null && verse > maxVerse) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        verseCapMessage(book, chapter, maxVerse),
        createVerseCapDetails(book, chapter, maxVerse, verse)
      );
    }
    return {
      book,
      chapter,
      verse
    };
  }
  const chapterMatch = token.match(CHAPTER_REFERENCE_REGEX);
  if (chapterMatch) {
    const rawBook = chapterMatch[1];
    const chapterText = chapterMatch[2];
    if (!rawBook || !chapterText) {
      throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
    }
    const book = rawBook.toUpperCase();
    if (!isOsisBookCode(book)) {
      throw new PassageParseError("INVALID_BOOK", `Unknown book code: ${rawBook}.`);
    }
    const chapter = toPositiveInteger(chapterText);
    const maxChapter = getMaxChapter(book);
    if (chapter > maxChapter) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        chapterCapMessage(book, maxChapter),
        createChapterCapDetails(book, maxChapter, chapter)
      );
    }
    return {
      book,
      chapter
    };
  }
  throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
}
function createNaturalPassagePart(bookRaw, chapterRaw, verseRaw) {
  const primaryBook = resolveBookAlias(bookRaw);
  if (!primaryBook) {
    return null;
  }
  const chapter = toPositiveIntegerOrNull(chapterRaw);
  if (!chapter) {
    return null;
  }
  let book = primaryBook;
  const maxChapter = getMaxChapter(book);
  if (chapter > maxChapter) {
    const fallback = resolveChapterFallbackBookAlias(bookRaw, chapter, primaryBook);
    if (!fallback) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        chapterCapMessage(book, maxChapter),
        createChapterCapDetails(book, maxChapter, chapter)
      );
    }
    book = fallback;
  }
  if (!verseRaw) {
    return {
      book,
      chapter
    };
  }
  const verse = toPositiveIntegerOrNull(verseRaw);
  if (!verse) {
    return null;
  }
  const maxVerse = getMaxVerse(book, chapter);
  if (maxVerse !== null && verse > maxVerse) {
    throw new PassageParseError(
      "INVALID_FORMAT",
      verseCapMessage(book, chapter, maxVerse),
      createVerseCapDetails(book, chapter, maxVerse, verse)
    );
  }
  return {
    book,
    chapter,
    verse
  };
}
function parseNaturalReference(input) {
  const normalized = normalizeNaturalToken(input);
  if (!normalized) {
    return null;
  }
  const osisLikeVerse = normalized.match(/^(.+?)\s*[.]\s*(\d+)\s*[.]\s*(\d+)$/i);
  if (osisLikeVerse) {
    const bookRaw = osisLikeVerse[1];
    const chapterRaw = osisLikeVerse[2];
    const verseRaw = osisLikeVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }
  const pathLikeVerse = normalized.match(/^(.+?)\s*\/\s*(\d+)\s*[/:.]\s*(\d+)$/i);
  if (pathLikeVerse) {
    const bookRaw = pathLikeVerse[1];
    const chapterRaw = pathLikeVerse[2];
    const verseRaw = pathLikeVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }
  const chapterVerse = normalized.match(/^(.+?)\s*(\d+)\s*[:.]\s*(\d+)$/i);
  if (chapterVerse) {
    const bookRaw = chapterVerse[1];
    const chapterRaw = chapterVerse[2];
    const verseRaw = chapterVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }
  const spaceSeparatedVerse = normalized.match(/^(.+?)\s+(\d+)\s+(\d+)$/i);
  if (spaceSeparatedVerse) {
    const bookRaw = spaceSeparatedVerse[1];
    const chapterRaw = spaceSeparatedVerse[2];
    const verseRaw = spaceSeparatedVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }
  const compactVerse = normalized.match(/^([1-3]?[a-zA-Z]+)(\d+)[:.](\d+)$/i);
  if (compactVerse) {
    const bookRaw = compactVerse[1];
    const chapterRaw = compactVerse[2];
    const verseRaw = compactVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }
  const compactChapter = normalized.match(/^([1-3]?[a-zA-Z]+)(\d+)$/i);
  if (compactChapter) {
    const bookRaw = compactChapter[1];
    const chapterRaw = compactChapter[2];
    if (bookRaw && chapterRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw);
    }
  }
  const dottedOrPathChapter = normalized.match(/^(.+?)\s*[./]\s*(\d+)$/i);
  if (dottedOrPathChapter) {
    const bookRaw = dottedOrPathChapter[1];
    const chapterRaw = dottedOrPathChapter[2];
    if (bookRaw && chapterRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw);
    }
  }
  const chapterOnly = normalized.match(/^(.+?)\s+(\d+)$/i);
  if (chapterOnly) {
    const bookRaw = chapterOnly[1];
    const chapterRaw = chapterOnly[2];
    if (bookRaw && chapterRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw);
    }
  }
  return null;
}
function normalizeNaturalPassage(input) {
  const normalized = normalizeNaturalToken(input);
  if (!normalized) {
    return null;
  }
  const pieces = normalized.split(/\s*-\s*/);
  if (pieces.length === 2) {
    const leftRaw = pieces[0];
    const rightRaw = pieces[1];
    if (!leftRaw || !rightRaw) {
      return null;
    }
    const left = parseNaturalReference(leftRaw);
    if (!left) {
      return null;
    }
    const rightDigitsOnly = rightRaw.match(/^\d+$/);
    if (rightDigitsOnly) {
      if (hasVerse2(left)) {
        return `${left.book}.${left.chapter}.${left.verse}-${rightRaw}`;
      }
      return `${left.book}.${left.chapter}-${rightRaw}`;
    }
    const rightChapterVerse = rightRaw.match(/^(\d+)\s*[:.]\s*(\d+)$/);
    if (rightChapterVerse) {
      const rightChapterRaw = rightChapterVerse[1];
      const rightVerseRaw = rightChapterVerse[2];
      if (!rightChapterRaw || !rightVerseRaw) {
        return null;
      }
      const right2 = parseReferenceToken(`${left.book}.${rightChapterRaw}.${rightVerseRaw}`);
      if (left.book === right2.book && hasVerse2(left) && hasVerse2(right2) && left.chapter === right2.chapter) {
        return `${left.book}.${left.chapter}.${left.verse}-${right2.verse}`;
      }
      return `${formatPart2(left)}-${formatPart2(right2)}`;
    }
    const right = parseNaturalReference(rightRaw);
    if (!right) {
      return null;
    }
    if (left.book === right.book && hasVerse2(left) && hasVerse2(right) && left.chapter === right.chapter) {
      return `${left.book}.${left.chapter}.${left.verse}-${right.verse}`;
    }
    if (left.book === right.book && !hasVerse2(left) && !hasVerse2(right)) {
      return `${left.book}.${left.chapter}-${right.chapter}`;
    }
    return `${formatPart2(left)}-${formatPart2(right)}`;
  }
  if (pieces.length !== 1) {
    return null;
  }
  const singleRaw = pieces[0];
  if (!singleRaw) {
    return null;
  }
  const single = parseNaturalReference(singleRaw);
  if (!single) {
    return null;
  }
  return formatPart2(single);
}
function normalizePassageInput(input) {
  const naturalNormalized = normalizeNaturalPassage(input);
  if (naturalNormalized) {
    return normalizeToken(naturalNormalized);
  }
  return normalizeToken(input);
}
function compareForRange(start, end) {
  const startBookOrder = getBookOrder(start.book);
  const endBookOrder = getBookOrder(end.book);
  if (startBookOrder === void 0 || endBookOrder === void 0) {
    return 0;
  }
  if (startBookOrder !== endBookOrder) {
    return startBookOrder - endBookOrder;
  }
  if (start.chapter !== end.chapter) {
    return start.chapter - end.chapter;
  }
  const startVerse = hasVerse2(start) ? start.verse : 0;
  const endVerse = hasVerse2(end) ? end.verse : Number.MAX_SAFE_INTEGER;
  return startVerse - endVerse;
}
function canonicalize(start, end) {
  const sameBook = start.book === end.book;
  const sameChapter = sameBook && start.chapter === end.chapter;
  const startHasVerse = hasVerse2(start);
  const endHasVerse = hasVerse2(end);
  if (sameChapter && startHasVerse && endHasVerse && start.verse === end.verse) {
    return {
      canonical: `${start.book}.${start.chapter}.${start.verse}`,
      rangeType: "single"
    };
  }
  if (sameChapter && !startHasVerse && !endHasVerse) {
    return {
      canonical: `${start.book}.${start.chapter}`,
      rangeType: "chapter"
    };
  }
  if (sameChapter && startHasVerse && endHasVerse) {
    return {
      canonical: `${start.book}.${start.chapter}.${start.verse}-${end.verse}`,
      rangeType: "same_chapter"
    };
  }
  if (sameBook && !startHasVerse && !endHasVerse) {
    return {
      canonical: `${start.book}.${start.chapter}-${end.chapter}`,
      rangeType: "chapter_range"
    };
  }
  return {
    canonical: `${formatPart2(start)}-${formatPart2(end)}`,
    rangeType: "cross_reference"
  };
}
function parsePassage(input) {
  if (!input?.trim()) {
    throw new PassageParseError("EMPTY", "Passage is required.");
  }
  const normalized = normalizePassageInput(input);
  if (!normalized) {
    throw new PassageParseError("EMPTY", "Passage is required.");
  }
  const pieces = normalized.split("-");
  if (pieces.length > 2 || pieces.some((piece) => piece.length === 0)) {
    throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
  }
  const startToken = pieces[0];
  if (!startToken) {
    throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
  }
  const start = parseReferenceToken(startToken);
  const endToken = pieces[1];
  let end;
  if (!endToken) {
    end = start;
  } else if (/^\d+$/.test(endToken)) {
    if (hasVerse2(start)) {
      const endVerse = toPositiveInteger(endToken);
      const maxVerse = getMaxVerse(start.book, start.chapter);
      if (maxVerse !== null && endVerse > maxVerse) {
        throw new PassageParseError(
          "INVALID_FORMAT",
          verseCapMessage(start.book, start.chapter, maxVerse),
          createVerseCapDetails(start.book, start.chapter, maxVerse, endVerse)
        );
      }
      end = {
        book: start.book,
        chapter: start.chapter,
        verse: endVerse
      };
    } else {
      const endChapter = toPositiveInteger(endToken);
      const maxChapter = getMaxChapter(start.book);
      if (endChapter > maxChapter) {
        throw new PassageParseError(
          "INVALID_FORMAT",
          chapterCapMessage(start.book, maxChapter),
          createChapterCapDetails(start.book, maxChapter, endChapter)
        );
      }
      end = {
        book: start.book,
        chapter: endChapter
      };
    }
  } else {
    end = parseReferenceToken(endToken);
  }
  if (compareForRange(start, end) > 0) {
    throw new PassageParseError("REVERSED_RANGE", "Passage range end must be greater than or equal to start.");
  }
  const { canonical, rangeType } = canonicalize(start, end);
  return {
    input,
    canonical,
    start,
    end,
    rangeType
  };
}
function tryParsePassage(input) {
  try {
    return { ok: true, value: parsePassage(input) };
  } catch (error) {
    if (error instanceof PassageParseError) {
      return { ok: false, error };
    }
    return {
      ok: false,
      error: new PassageParseError("INVALID_FORMAT", "Unable to parse passage.")
    };
  }
}

// src/share.ts
var SHARE_QUERY_KEYS = ["reference", "passage", "search", "q", "ref", "scripture", "verse"];
var LOGOS_NEW_TESTAMENT_OFFSET = 21;
var URL_TOKEN_PATTERN = "(?:https?:\\/\\/|[a-z][a-z0-9+.-]*:\\/\\/|www\\.)[^\\s)]+";
var REFERENCE_TOKEN_PATTERN = "[1-3]?[A-Za-z]{2,}\\.\\d+(?:\\.\\d+)?(?:-[1-3]?[A-Za-z]{2,}\\.\\d+\\.\\d+|-\\d+)?(?:\\.[A-Za-z0-9]{2,8})?|(?:[1-3]\\s*)?[A-Za-z]+(?:\\s+of\\s+[A-Za-z]+)?\\s+\\d+(?:(?::|\\s)\\d+(?:-\\d+)?)?";
var LEADING_WRAPPER_REGEX = /^[([{"'`]+/;
var TRAILING_WRAPPER_REGEX = /[)\]}",;.!?'`]+$/;
var DEFAULT_ROUTE_BASE_URL = "https://route.bible";
var ENDURING_WORD_OVERRIDES = {
  PSA: "psalm",
  SNG: "song-of-solomon"
};
function toSlug(value) {
  return value.toLowerCase().replace(/['".,()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var ENDURING_WORD_SLUG_TO_BOOK = new Map(
  OSIS_BOOK_CODES.map((book) => [ENDURING_WORD_OVERRIDES[book] ?? toSlug(OSIS_BOOK_NAMES[book]), book])
);
function tryDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
function unique(values) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const value of values) {
    const token = value.trim();
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    out.push(token);
  }
  return out;
}
function toRouteBaseUrl(input) {
  try {
    return new URL(input ?? DEFAULT_ROUTE_BASE_URL);
  } catch {
    return new URL(DEFAULT_ROUTE_BASE_URL);
  }
}
function toNormalizedPassage(parsed, source, options = {}) {
  const slug = parsed.canonical.toLowerCase();
  const routePath = `/${encodeURIComponent(slug)}`;
  const baseUrl = toRouteBaseUrl(options.routeBaseUrl);
  const routeUrl = new URL(routePath, baseUrl).toString();
  return {
    input: parsed.input,
    canonical: parsed.canonical,
    display: formatPassageForDisplay(parsed),
    slug,
    routePath,
    routeUrl,
    start: { ...parsed.start },
    end: { ...parsed.end },
    rangeType: parsed.rangeType,
    source
  };
}
function stripTranslationSuffix(value) {
  const cleaned = value.trim().replace(/^[/#?]+|[/#?]+$/g, "");
  const match = cleaned.match(
    /^([1-3]?[A-Za-z]{2,}\.\d+(?:\.\d+)?(?:-[1-3]?[A-Za-z]{2,}\.\d+\.\d+|-\d+)?)(?:\.[A-Za-z0-9]{2,8})$/
  );
  if (match?.[1]) {
    return match[1];
  }
  return cleaned;
}
function resolveLogosBook(bookNumberRaw) {
  const bookNumber = Number.parseInt(bookNumberRaw, 10);
  if (!Number.isInteger(bookNumber) || bookNumber <= 0) {
    return null;
  }
  if (bookNumber >= 61 && bookNumber <= 87) {
    const shiftedNumber = bookNumber - LOGOS_NEW_TESTAMENT_OFFSET;
    if (shiftedNumber >= 40 && shiftedNumber <= OSIS_BOOK_CODES.length) {
      return OSIS_BOOK_CODES[shiftedNumber - 1] ?? null;
    }
  }
  return OSIS_BOOK_CODES[bookNumber - 1] ?? null;
}
function parseLogosReference(value) {
  const decoded = tryDecode(value).trim().replace(/^[/#?]+|[/#?]+$/g, "");
  if (!decoded) {
    return null;
  }
  const segment = decoded.split("/").filter(Boolean).pop() ?? decoded;
  const match = segment.match(
    /^bible(?:\+[a-z0-9_-]+)?\.(\d+)\.(\d+)(?:\.(\d+))?(?:-(\d+))?(?:\.[a-z][a-z0-9_-]*)*$/i
  );
  if (!match) {
    return null;
  }
  const [, bookNumberRaw, chapterRaw, verseRaw, rangeEndRaw] = match;
  if (!bookNumberRaw || !chapterRaw) {
    return null;
  }
  const book = resolveLogosBook(bookNumberRaw);
  if (!book) {
    return null;
  }
  const chapter = Number.parseInt(chapterRaw, 10);
  if (!Number.isInteger(chapter) || chapter <= 0) {
    return null;
  }
  if (!verseRaw) {
    return `${book}.${chapter}`;
  }
  const verse = Number.parseInt(verseRaw, 10);
  if (!Number.isInteger(verse) || verse <= 0) {
    return null;
  }
  if (!rangeEndRaw) {
    return `${book}.${chapter}.${verse}`;
  }
  const rangeEnd = Number.parseInt(rangeEndRaw, 10);
  if (!Number.isInteger(rangeEnd) || rangeEnd < verse) {
    return null;
  }
  return `${book}.${chapter}.${verse}-${rangeEnd}`;
}
function candidateVariants(value) {
  const decoded = tryDecode(value);
  const normalized = decoded.replace(/_/g, " ");
  const stripped = normalized.replace(/^["'`]+|["'`]+$/g, "");
  const withoutTranslation = stripTranslationSuffix(stripped);
  return unique([value, decoded, normalized, stripped, withoutTranslation]);
}
function tryCanonicalFromCandidate(value) {
  const logosCanonical = parseLogosReference(value);
  if (logosCanonical) {
    return logosCanonical;
  }
  for (const candidate of candidateVariants(value)) {
    const logosVariantCanonical = parseLogosReference(candidate);
    if (logosVariantCanonical) {
      return logosVariantCanonical;
    }
    try {
      return parsePassage(candidate).canonical;
    } catch {
      continue;
    }
  }
  return null;
}
function tryParseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    if (raw.startsWith("www.")) {
      try {
        return new URL(`https://${raw}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}
function parseEnduringWordPath(pathname) {
  const match = pathname.match(/\/bible-commentary\/([a-z0-9-]+)-(\d+)\/?$/i);
  const slug = match?.[1]?.toLowerCase();
  const chapter = match?.[2];
  if (!slug || !chapter) {
    return null;
  }
  const book = ENDURING_WORD_SLUG_TO_BOOK.get(slug);
  if (!book) {
    return null;
  }
  return `${book}.${chapter}`;
}
function extractBibleSegmentReference(segments) {
  const bibleIndex = segments.findIndex((segment) => segment.toLowerCase() === "bible");
  if (bibleIndex < 0) {
    return null;
  }
  const next = segments[bibleIndex + 1];
  if (!next) {
    return null;
  }
  if (/^\d+$/.test(next)) {
    return segments[bibleIndex + 2] ?? null;
  }
  return next;
}
function parseVerseAnchor(hash) {
  const cleaned = hash.trim().replace(/^[/#?]+|[/#?]+$/g, "");
  const match = cleaned.match(/^(?:v(?:erse)?[=:.-]?)?(\d+)(?:-(\d+))?$/i);
  if (!match?.[1]) {
    return null;
  }
  const start = Number.parseInt(match[1], 10);
  if (!Number.isInteger(start) || start <= 0) {
    return null;
  }
  const endRaw = match[2];
  if (!endRaw) {
    return `${start}`;
  }
  const end = Number.parseInt(endRaw, 10);
  if (!Number.isInteger(end) || end < start) {
    return null;
  }
  return `${start}-${end}`;
}
function extractUrlTokens(text) {
  return text.match(new RegExp(URL_TOKEN_PATTERN, "gi")) ?? [];
}
function extractReferenceTokens(text) {
  return unique(text.match(new RegExp(REFERENCE_TOKEN_PATTERN, "gi")) ?? []);
}
function normalizeCandidateToken(raw) {
  return raw.trim().replace(LEADING_WRAPPER_REGEX, "").replace(TRAILING_WRAPPER_REGEX, "").trim();
}
function collectCandidateMatches(input) {
  const byToken = /* @__PURE__ */ new Map();
  const addCandidate = (rawToken, index, priority) => {
    const token = normalizeCandidateToken(rawToken);
    if (!token) {
      return;
    }
    const existing = byToken.get(token);
    if (!existing || index < existing.index || index === existing.index && priority > existing.priority) {
      byToken.set(token, { token, index, priority });
    }
  };
  for (const match of input.matchAll(new RegExp(URL_TOKEN_PATTERN, "gi"))) {
    if (!match[0]) {
      continue;
    }
    addCandidate(match[0], match.index ?? 0, 3);
  }
  for (const match of input.matchAll(new RegExp(REFERENCE_TOKEN_PATTERN, "gi"))) {
    if (!match[0]) {
      continue;
    }
    addCandidate(match[0], match.index ?? 0, 2);
  }
  return Array.from(byToken.values()).sort((a, b) => a.index - b.index || b.priority - a.priority || b.token.length - a.token.length);
}
function tryParseCanonical(canonical) {
  try {
    return parsePassage(canonical);
  } catch {
    return null;
  }
}
function normalizeUrlSurface(text) {
  return tryDecode(text).replace(/[_./?&#=+%-]+/g, " ").replace(/\s+/g, " ").trim();
}
function extractReferenceWindows(text) {
  const tokens = text.match(/[A-Za-z0-9]+/g) ?? [];
  const cappedTokens = tokens.slice(0, 80);
  const out = [];
  for (let start = 0; start < cappedTokens.length; start += 1) {
    for (let length = 2; length <= 6 && start + length <= cappedTokens.length; length += 1) {
      const slice = cappedTokens.slice(start, start + length);
      const hasLetter = slice.some((token) => /[a-z]/i.test(token));
      const hasDigit = slice.some((token) => /\d/.test(token));
      if (!hasLetter || !hasDigit) {
        continue;
      }
      out.push(slice.join(" "));
      const lastTwo = slice.slice(-2);
      if (/^\d+$/.test(lastTwo[0] ?? "") && /^\d+$/.test(lastTwo[1] ?? "")) {
        const bookTokens = slice.slice(0, -2);
        if (bookTokens.length > 0) {
          out.push(`${bookTokens.join(" ")} ${lastTwo[0]}:${lastTwo[1]}`);
        }
      }
      const lastThree = slice.slice(-3);
      if (lastThree.length === 3 && lastThree.every((token) => /^\d+$/.test(token))) {
        const bookTokens = slice.slice(0, -3);
        if (bookTokens.length > 0) {
          out.push(`${bookTokens.join(" ")} ${lastThree[0]}:${lastThree[1]}-${lastThree[2]}`);
        }
      }
    }
  }
  return unique(out);
}
function canonicalSpecificityScore(canonical) {
  try {
    const parsed = parsePassage(canonical);
    switch (parsed.rangeType) {
      case "cross_reference":
        return 140;
      case "same_chapter":
        return 130;
      case "single":
        return 120;
      case "chapter_range":
        return 60;
      case "chapter":
        return 40;
      default:
        return 10;
    }
  } catch {
    return 0;
  }
}
function selectBestCanonical(candidates) {
  let best = null;
  for (const candidate of unique(candidates)) {
    const canonical = tryCanonicalFromCandidate(candidate);
    if (!canonical) {
      continue;
    }
    const score = canonicalSpecificityScore(canonical);
    const candidateLength = candidate.length;
    if (!best) {
      best = { canonical, score, candidateLength };
      continue;
    }
    if (score > best.score) {
      best = { canonical, score, candidateLength };
      continue;
    }
    if (score === best.score && candidateLength < best.candidateLength) {
      best = { canonical, score, candidateLength };
    }
  }
  return best?.canonical ?? null;
}
function parseFromUrl(raw) {
  const parsed = tryParseUrl(raw);
  if (!parsed) {
    return null;
  }
  const candidates = [];
  const chapterContextCandidates = [];
  const pathname = tryDecode(parsed.pathname);
  const segments = pathname.split("/").filter(Boolean).map((segment) => tryDecode(segment));
  const addChapterContextCandidate = (candidate) => {
    if (!candidate) {
      return;
    }
    candidates.push(candidate);
    chapterContextCandidates.push(candidate);
  };
  if (segments[0] === "v1" && segments[1] === "p" && segments[2]) {
    addChapterContextCandidate(segments[2]);
  }
  addChapterContextCandidate(extractBibleSegmentReference(segments) ?? void 0);
  for (const segment of segments) {
    if (/\d/.test(segment)) {
      candidates.push(segment);
    }
  }
  if (parsed.hostname.includes("logos.com")) {
    const bibleIndex = segments.findIndex((segment) => segment.toLowerCase() === "bible");
    const logosReference = bibleIndex >= 0 ? segments[bibleIndex + 1] : void 0;
    if (logosReference) {
      candidates.push(logosReference);
    }
    const referencesIndex = segments.findIndex((segment) => segment.toLowerCase() === "references");
    const logosDataReference = referencesIndex >= 0 ? segments[referencesIndex + 1] : void 0;
    if (logosDataReference) {
      candidates.push(logosDataReference);
    }
  }
  if (parsed.hostname.includes("biblegateway.com")) {
    const search = parsed.searchParams.get("search");
    if (search) {
      candidates.push(search);
    }
  }
  for (const value of parsed.searchParams.values()) {
    if (value) {
      candidates.push(value);
    }
  }
  const enduringWord = parseEnduringWordPath(pathname);
  if (enduringWord) {
    candidates.push(enduringWord);
  }
  for (const key of SHARE_QUERY_KEYS) {
    const value = parsed.searchParams.get(key);
    if (value) {
      candidates.push(value);
    }
  }
  if (parsed.hash) {
    const hash = tryDecode(parsed.hash.slice(1));
    if (hash) {
      candidates.push(hash);
      const hashParams = new URLSearchParams(hash);
      for (const key of SHARE_QUERY_KEYS) {
        const value = hashParams.get(key);
        if (value) {
          candidates.push(value);
        }
      }
      for (const value of hashParams.values()) {
        if (value) {
          candidates.push(value);
        }
      }
      const verseAnchor = parseVerseAnchor(hash);
      if (verseAnchor) {
        for (const chapterContext of unique(chapterContextCandidates)) {
          const canonical = tryCanonicalFromCandidate(chapterContext);
          if (!canonical) {
            continue;
          }
          try {
            const parsedCanonical = parsePassage(canonical);
            if (parsedCanonical.rangeType !== "chapter") {
              continue;
            }
          } catch {
            continue;
          }
          candidates.push(`${canonical}.${verseAnchor}`);
        }
      }
    }
  }
  const structuralCanonical = selectBestCanonical(candidates);
  if (structuralCanonical) {
    return structuralCanonical;
  }
  const genericSources = unique([
    parsed.hostname,
    pathname,
    ...segments,
    tryDecode(parsed.search),
    tryDecode(parsed.hash),
    tryDecode(`${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`)
  ]);
  for (const source of genericSources) {
    const normalized = normalizeUrlSurface(source);
    if (!normalized) {
      continue;
    }
    candidates.push(normalized);
    candidates.push(...extractReferenceTokens(normalized));
    candidates.push(...extractReferenceWindows(normalized));
  }
  return selectBestCanonical(candidates);
}
function parseFromText(raw) {
  const direct = tryCanonicalFromCandidate(raw);
  if (direct) {
    return direct;
  }
  for (const token of extractUrlTokens(raw)) {
    const canonical = parseFromUrl(token);
    if (canonical) {
      return canonical;
    }
  }
  for (const token of extractReferenceTokens(raw)) {
    const canonical = tryCanonicalFromCandidate(token);
    if (canonical) {
      return canonical;
    }
  }
  return null;
}
function parseCandidateCanonical(candidate) {
  return parseFromUrl(candidate) ?? tryCanonicalFromCandidate(candidate) ?? parseFromText(candidate);
}
function findMultipleAnyPassages(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }
  const passages = [];
  const seenCanonical = /* @__PURE__ */ new Set();
  const addPassage = (parsed) => {
    if (!parsed || seenCanonical.has(parsed.canonical)) {
      return;
    }
    seenCanonical.add(parsed.canonical);
    passages.push(parsed);
  };
  for (const candidate of collectCandidateMatches(trimmed)) {
    const canonical = parseCandidateCanonical(candidate.token);
    if (!canonical) {
      continue;
    }
    addPassage(tryParseCanonical(canonical));
  }
  if (passages.length > 0) {
    return passages;
  }
  addPassage(findSingleAnyPassage(trimmed));
  return passages;
}
function extractSharedCanonical(payload) {
  const values = [payload.url, payload.text, payload.title].filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean);
  for (const value of values) {
    const fromUrl = parseFromUrl(value);
    if (fromUrl) {
      return fromUrl;
    }
    const fromText = parseFromText(value);
    if (fromText) {
      return fromText;
    }
  }
  return null;
}
function normalizeSharedPassage(payload, options = {}) {
  const candidates = [];
  const addCandidate = (kind, value) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return;
    }
    candidates.push({ kind, value: trimmed });
  };
  addCandidate("url", payload.url);
  addCandidate("text", payload.text);
  addCandidate("title", payload.title);
  for (const candidate of candidates) {
    const canonical = parseCandidateCanonical(candidate.value);
    if (!canonical) {
      continue;
    }
    const parsed = tryParseCanonical(canonical);
    if (!parsed) {
      continue;
    }
    return toNormalizedPassage(parsed, candidate, options);
  }
  return null;
}
function parseSharedPassage(payload) {
  const normalized = normalizeSharedPassage(payload);
  if (!normalized) {
    return null;
  }
  return tryParseCanonical(normalized.canonical);
}
function tryParseSharedPassage(payload) {
  const canonical = extractSharedCanonical(payload);
  if (!canonical) {
    return { ok: false, error: new PassageParseError("EMPTY", "Passage is required.") };
  }
  try {
    return { ok: true, value: parsePassage(canonical) };
  } catch (error) {
    if (error instanceof PassageParseError) {
      return { ok: false, error };
    }
    return {
      ok: false,
      error: new PassageParseError("INVALID_FORMAT", "Unable to parse passage.")
    };
  }
}
function getAnyPassageCandidate(input) {
  const value = input.trim();
  if (!value) {
    return null;
  }
  const sharedCanonical = extractSharedCanonical({
    title: value,
    text: value,
    url: value
  });
  return sharedCanonical ?? value;
}
function findSingleAnyPassage(input) {
  const candidate = getAnyPassageCandidate(input);
  if (!candidate) {
    return null;
  }
  try {
    return parsePassage(candidate);
  } catch {
    return null;
  }
}
function normalizeAnyPassage(input, options = {}) {
  const parsed = findSingleAnyPassage(input);
  if (!parsed) {
    return null;
  }
  return toNormalizedPassage(parsed, { kind: "input", value: input }, options);
}
function tryParseSingleAnyPassage(input) {
  const candidate = getAnyPassageCandidate(input);
  if (!candidate) {
    return { ok: false, error: new PassageParseError("EMPTY", "Passage is required.") };
  }
  try {
    return { ok: true, value: parsePassage(candidate) };
  } catch (error) {
    if (error instanceof PassageParseError) {
      return { ok: false, error };
    }
    return {
      ok: false,
      error: new PassageParseError("INVALID_FORMAT", "Unable to parse passage.")
    };
  }
}
function parseAnyPassage(input, options = {}) {
  const result = options.multiple ? tryParseAnyPassage(input, { multiple: true }) : tryParseAnyPassage(input);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}
function findAnyPassage(input, options = {}) {
  if (options.multiple) {
    return findMultipleAnyPassages(input);
  }
  return findSingleAnyPassage(input);
}
function tryParseAnyPassage(input, options = {}) {
  if (options.multiple) {
    const passages = findMultipleAnyPassages(input);
    if (passages.length > 0) {
      return { ok: true, value: passages };
    }
    const fallback = tryParseSingleAnyPassage(input);
    if (!fallback.ok) {
      return fallback;
    }
    return { ok: true, value: [fallback.value] };
  }
  return tryParseSingleAnyPassage(input);
}

export {
  formatPassageForDisplay,
  PassageParseError,
  parsePassage,
  tryParsePassage,
  extractSharedCanonical,
  normalizeSharedPassage,
  parseSharedPassage,
  tryParseSharedPassage,
  normalizeAnyPassage,
  parseAnyPassage,
  findAnyPassage,
  tryParseAnyPassage
};
