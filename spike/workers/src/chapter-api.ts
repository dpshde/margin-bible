import { noteJson, type NoteRecord } from "./library";
import {
  createPassage,
  nextChapter,
  passageLabel,
  passageOsis,
  passageSlug,
  prevChapter,
  routeBibleUrl,
  type Passage,
} from "./passage";
import type { ChapterPack } from "./usj";

export function passageJson(passage: Passage) {
  return {
    slug: passageSlug(passage),
    osis: passageOsis(passage),
    label: passageLabel(passage),
    kind: passage.kind,
    book: passage.book,
    chapter: passage.chapter,
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
  };
}

export function chapterJson(passage: Passage, pack: ChapterPack, notes: NoteRecord[]) {
  const previous = prevChapter(passage);
  const following = nextChapter(passage);
  const chapterPassage = createPassage(pack.book, pack.chapter);
  return {
    ok: true as const,
    passage: passageJson(passage),
    chapter: {
      slug: passageSlug(chapterPassage),
      label: passageLabel(chapterPassage),
      translation: pack.translation,
      book: pack.book,
      chapter: pack.chapter,
      verses: pack.verses,
    },
    routeBibleUrl: routeBibleUrl(passage),
    prev: previous ? passageSlug(previous) : null,
    next: following ? passageSlug(following) : null,
    notes: notes.map(noteJson),
  };
}
