/**
 * Port of Margin::StudyPrep — groups BSB verse text with library notes and
 * gap-preserving question scaffolds. Never invents observations for unannotated verses.
 */

import type { NoteRecord } from "./library";
import { bodyText } from "./notes";
import { passageLabel, passageSlug, type Passage } from "./passage";
import type { ChapterPack, VerseRow } from "./usj";

export type StudyKind = "personal" | "group";

export type StudyObservation = {
  verse: number | null;
  slug: string | null;
  text: string;
};

export type StudyQuestion = {
  kind: string;
  from_note: string;
  text: string;
  source_verse: number | null;
  from: string;
};

export type StudyVerse = {
  n: number;
  text: string;
  observations: string[];
};

export type StudySection = {
  label: string;
  start: number;
  end: number;
  heading: string | null;
  launcher_url: string;
  verses: StudyVerse[];
  observations: StudyObservation[];
  questions: StudyQuestion[];
};

export type StudyPrepResult = {
  kind: StudyKind;
  passage: {
    label: string;
    slug: string;
    book: string;
    chapter: number;
    title_url: string;
  };
  missing_observations: boolean;
  brief: string;
  convictions: StudyObservation[];
  warmup: StudyQuestion[];
  sections: StudySection[];
  markdown: string;
};

const TARGET_MIN = 3;
const TARGET_MAX = 4;
const OBVIOUS = /\b(jesus is (god|the son|lord|divine)|god is love|jesus (died|rose) for (us|our)|the gospel is)\b/i;
const TENSION = /\b(warning|must|never|if |but |danger|false|afraid|hard|confus|misread|seem(s)? to mean)\b/i;

const GROUP_BRIEF = `Small-group prep. Consider the leader's notes; do not treat them as the answer the group must recite.
Do not invent verse-by-verse observations. Do not preach the landing in the question — leave a gap.
Kruger's shapes (TGC, 2017):
1. Warm-up — everyone can answer before the passage; it sets a theme the notes noticed in the text.
2. Google map — many good routes; don't telegraph the one point.
3. Houston — a likely misread the notes flagged; chew on it with the rest of Scripture.
4. Achilles heel — the hard question about this span the notes make it unwise to dodge.
If a span has no notes, still serve the Scripture; leave questions empty.`;

const PERSONAL_BRIEF = `Personal study. Help the reader go deeper in the text — learn, understand, sit with it.
Consider their notes; don't make those notes the answer. Don't preach the landing in the question — leave a gap.
Do not invent verse-by-verse observations. Do not write small-group facilitation questions.
Press what is still cloudy, where the same thing shows up again, how they might be misreading.
Not trick-obvious. Not slogans. Not mainly self-improvement. Empty question spans stay empty.`;

const KIND_LABEL: Record<string, string> = {
  warmup: "Warm-up",
  google_map: "Google map",
  houston: "Houston",
  achilles: "Achilles heel",
  lifted: "From your notes",
  open: "Open",
  trace: "Trace",
  check: "Check",
  press: "Press",
};

type VerseGroup = { heading: string | null; verses: VerseRow[] };

export function buildStudyPrep(input: {
  passage: Passage;
  pack: ChapterPack | null;
  notes: NoteRecord[];
  extraNotes?: string | null;
  kind: StudyKind;
}): StudyPrepResult {
  const kind: StudyKind = input.kind === "personal" ? "personal" : "group";
  const notes = input.notes;
  const extra = input.extraNotes?.trim() || null;
  const rows = filterVerseRows(input.pack?.verses ?? [], input.passage);
  const grouped = decorateGroups(rebalance(groupByHeading(rows)), input.passage, notes, extra, kind);
  const throughLine = chapterConvictions(notes);
  const missing =
    grouped.every((section) => section.observations.length === 0) &&
    throughLine.length === 0 &&
    !extra;
  const warmup = !missing && kind === "group" ? warmupQuestions(grouped, throughLine) : [];
  const passageMeta = {
    label: passageLabel(input.passage),
    slug: passageSlug(input.passage),
    book: input.passage.book,
    chapter: input.passage.chapter,
    title_url: `https://route.bible/${passageSlug(input.passage)}?utm_source=obsidian&utm_medium=note`,
  };
  return {
    kind,
    passage: passageMeta,
    missing_observations: missing,
    brief: (kind === "group" ? GROUP_BRIEF : PERSONAL_BRIEF).trim(),
    convictions: throughLine,
    warmup,
    sections: grouped,
    markdown: toMarkdown(kind, input.passage, grouped, warmup, throughLine, extra),
  };
}

function filterVerseRows(verses: VerseRow[], passage: Passage): VerseRow[] {
  if (passage.verseStart == null) return verses;
  const lo = passage.verseStart;
  const hi = passage.verseEnd ?? passage.verseStart;
  return verses.filter((row) => row.v >= lo && row.v <= hi);
}

function groupByHeading(rows: VerseRow[]): VerseGroup[] {
  const groups: VerseGroup[] = [];
  for (const row of rows) {
    if (row.heading || groups.length === 0) {
      groups.push({ heading: row.heading ?? null, verses: [] });
    }
    groups[groups.length - 1].verses.push(row);
  }
  return groups;
}

function rebalance(groups: VerseGroup[]): VerseGroup[] {
  let next = groups.filter((group) => group.verses.length > 0);
  if (next.length === 0) return next;

  while (next.length > TARGET_MAX) {
    let best = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < next.length - 1; i++) {
      const score = next[i].verses.length + next[i + 1].verses.length;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    next[best].verses = next[best].verses.concat(next[best + 1].verses);
    next[best].heading = next[best].heading ?? next[best + 1].heading;
    next = next.filter((_, i) => i !== best + 1);
  }

  while (next.length < TARGET_MIN) {
    let best = 0;
    let bestSize = -1;
    for (let i = 0; i < next.length; i++) {
      if (next[i].verses.length > bestSize) {
        bestSize = next[i].verses.length;
        best = i;
      }
    }
    const verses = next[best].verses;
    if (verses.length < 4) break;
    const mid = Math.floor(verses.length / 2);
    next = [
      ...next.slice(0, best),
      { heading: next[best].heading, verses: verses.slice(0, mid) },
      { heading: null, verses: verses.slice(mid) },
      ...next.slice(best + 1),
    ];
  }

  return next;
}

function decorateGroups(
  groups: VerseGroup[],
  passage: Passage,
  notes: NoteRecord[],
  extra: string | null,
  kind: StudyKind,
): StudySection[] {
  return groups.map((group, index) => {
    const start = group.verses[0].v;
    const end = group.verses[group.verses.length - 1].v;
    const observations = observationsFor(notes, start, end);
    if (index === 0 && extra) {
      for (const text of splitObservations(extra)) {
        observations.push({ verse: start, slug: null, text });
      }
    }
    return {
      label: start === end ? `v. ${start}` : `vv. ${start}-${end}`,
      start,
      end,
      heading: group.heading,
      launcher_url: `https://route.bible/${passage.book.toLowerCase()}.${passage.chapter}.${start}${
        end !== start ? `-${end}` : ""
      }?mode=launcher`,
      verses: group.verses.map((row) => ({
        n: row.v,
        text: row.text,
        observations: observations.filter((obs) => obs.verse === row.v).map((obs) => obs.text),
      })),
      observations,
      questions: draftQuestions(observations, start, end, kind),
    };
  });
}

function chapterConvictions(notes: NoteRecord[]): StudyObservation[] {
  const items: StudyObservation[] = [];
  for (const note of notes) {
    if (note.kind !== "chapter") continue;
    const body = bodyText(note.blocks).trim();
    if (!body) continue;
    for (const text of splitObservations(body)) {
      items.push({ verse: null, slug: note.slug, text });
    }
  }
  return items;
}

function observationsFor(notes: NoteRecord[], start: number, end: number): StudyObservation[] {
  const items: StudyObservation[] = [];
  for (const note of notes) {
    if (note.kind === "chapter" || note.verseStart == null) continue;
    const last = note.verseEnd ?? note.verseStart;
    if (last < start || note.verseStart > end) continue;
    const body = bodyText(note.blocks).trim();
    if (!body) continue;
    for (const text of splitObservations(body)) {
      items.push({ verse: note.verseStart, slug: note.slug, text });
    }
  }
  return items;
}

function splitObservations(body: string): string[] {
  return body
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function warmupQuestions(grouped: StudySection[], throughLine: StudyObservation[]): StudyQuestion[] {
  const seed =
    throughLine.find((obs) => squeeze(obs.text).length >= 12) ||
    grouped.flatMap((section) => section.observations).find((obs) => squeeze(obs.text).length >= 12);
  if (!seed) return [];
  const clip = clipText(seed.text).replace(/\?$/, "");
  return [
    {
      kind: "warmup",
      from_note: squeeze(seed.text),
      text: `The notes flag this in the passage: “${clip}”. Before we open the text, where have you met something like that in ordinary life — not to moralize, but so we can hear what the text is actually doing?`,
      source_verse: seed.verse,
      from: seed.verse != null ? "observation" : "chapter",
    },
  ];
}

function draftQuestions(
  observations: StudyObservation[],
  start: number,
  end: number,
  kind: StudyKind,
): StudyQuestion[] {
  const label = start === end ? `v. ${start}` : `vv. ${start}–${end}`;
  const meaty = observations.filter((obs) => squeeze(obs.text).length >= 12);
  if (meaty.length === 0) return [];

  const drafts: StudyQuestion[] = [];
  const lifted = meaty.filter((obs) => obs.text.includes("?"));
  for (const obs of lifted) {
    drafts.push({
      kind: "lifted",
      from_note: squeeze(obs.text),
      text: squeeze(obs.text),
      source_verse: obs.verse,
      from: "lifted",
    });
  }

  const mapSeed = meaty.find((obs) => !obs.text.includes("?")) || meaty[0];
  const tensionSeed = meaty.find(
    (obs) => TENSION.test(squeeze(obs.text)) || OBVIOUS.test(squeeze(obs.text)),
  );
  const hardSeed = lifted[lifted.length - 1] || meaty.reduce((a, b) =>
    squeeze(a.text).length >= squeeze(b.text).length ? a : b,
  );

  if (kind === "group") {
    if (mapSeed) drafts.push(googleMapQuestion(mapSeed, label));
    if (tensionSeed) drafts.push(houstonQuestion(tensionSeed, label));
    if (hardSeed) drafts.push(achillesQuestion(hardSeed, label));
  } else {
    if (mapSeed) {
      drafts.push(openQuestion(mapSeed, label));
      drafts.push(traceQuestion(mapSeed));
    }
    const checkSeed = tensionSeed || mapSeed;
    if (checkSeed) drafts.push(checkQuestion(checkSeed, label));
    if (hardSeed) drafts.push(pressQuestion(hardSeed, label));
  }

  const seen = new Set<string>();
  const unique: StudyQuestion[] = [];
  for (const q of drafts) {
    if (seen.has(q.text)) continue;
    seen.add(q.text);
    unique.push(q);
    if (unique.length >= 4) break;
  }
  return unique;
}

function googleMapQuestion(obs: StudyObservation, label: string): StudyQuestion {
  const clip = clipText(obs.text);
  return {
    kind: "google_map",
    from_note: squeeze(obs.text),
    text: `The notes on v.${obs.verse} notice “${clip}”. What other moments in ${label} or the rest of Scripture show the same thing — more than one route is good?`,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function houstonQuestion(obs: StudyObservation, label: string): StudyQuestion {
  const clip = clipText(obs.text);
  return {
    kind: "houston",
    from_note: squeeze(obs.text),
    text: `The notes on v.${obs.verse} flag “${clip}”. If someone left ${label} having inverted what the text is doing there, which other verses would you want in the room?`,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function achillesQuestion(obs: StudyObservation, label: string): StudyQuestion {
  const clip = clipText(obs.text);
  const text = obs.text.includes("?")
    ? `The notes already ask the hard one on v.${obs.verse}: ${squeeze(obs.text)} What makes that uncomfortable to sit with in ${label}?`
    : `Given the notes on v.${obs.verse} (“${clip}”), what’s the question in ${label} a leader might hope nobody asks?`;
  return {
    kind: "achilles",
    from_note: squeeze(obs.text),
    text,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function openQuestion(obs: StudyObservation, label: string): StudyQuestion {
  const clip = clipText(obs.text);
  return {
    kind: "open",
    from_note: squeeze(obs.text),
    text: `You wrote on v.${obs.verse}: “${clip}”. What in ${label} made that stand out — and what part of it is still cloudy?`,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function traceQuestion(obs: StudyObservation): StudyQuestion {
  const clip = clipText(obs.text);
  return {
    kind: "trace",
    from_note: squeeze(obs.text),
    text: `Your note on v.${obs.verse} (“${clip}”) — where else in this chapter or Scripture does that same thing show up, so you can see it more than once?`,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function checkQuestion(obs: StudyObservation, label: string): StudyQuestion {
  const clip = clipText(obs.text);
  return {
    kind: "check",
    from_note: squeeze(obs.text),
    text: `If your read of v.${obs.verse} (“${clip}”) were slightly off, what in ${label} would correct you?`,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function pressQuestion(obs: StudyObservation, label: string): StudyQuestion {
  const clip = clipText(obs.text);
  return {
    kind: "press",
    from_note: squeeze(obs.text),
    text: `Sit with your note on v.${obs.verse}: “${clip}”. If that’s true, what in ${label} still doesn’t sit easy?`,
    source_verse: obs.verse,
    from: obs.slug ? "observation" : "extra",
  };
}

function clipText(text: string): string {
  const clip = squeeze(text);
  return clip.length > 110 ? `${clip.slice(0, 107)}…` : clip;
}

function squeeze(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/^[-*]\s*/, "");
}

function toMarkdown(
  kind: StudyKind,
  passage: Passage,
  grouped: StudySection[],
  warmup: StudyQuestion[],
  throughLine: StudyObservation[],
  extra: string | null,
): string {
  const title =
    kind === "group"
      ? `${passageLabel(passage)} group study prep`
      : `${passageLabel(passage)} personal study`;
  const lines: string[] = [
    `# ${title}`,
    "",
    (kind === "group" ? GROUP_BRIEF : PERSONAL_BRIEF).trim(),
    "",
  ];
  if (
    grouped.every((section) => section.observations.length === 0) &&
    throughLine.length === 0 &&
    !extra
  ) {
    const who = kind === "group" ? "leader" : "you";
    lines.push(`_No notes yet. Have ${who} write observations first. Do not invent them._`, "");
  }
  if (throughLine.length > 0) {
    lines.push(kind === "group" ? "## Leader notes (consider these)" : "## Your notes on the chapter", "");
    for (const obs of throughLine) lines.push(`- ${squeeze(obs.text)}`);
    lines.push("");
  }
  if (warmup.length > 0) {
    lines.push("## Warm-up", "");
    for (const question of warmup) {
      lines.push(`- **${KIND_LABEL[question.kind] || question.kind}.** ${question.text}`);
    }
    lines.push("");
  }
  lines.push("## Scripture, notes, and questions", "");
  for (const section of grouped) {
    let heading = `### [${section.label}](${section.launcher_url})`;
    if (section.heading) heading += ` — ${section.heading}`;
    lines.push(heading, "");
    for (const verse of section.verses) {
      lines.push(`${verse.n}. ${verse.text}`);
      for (const obs of verse.observations) lines.push(`\t- ${squeeze(obs)}`);
    }
    lines.push("");
    if (section.questions.length === 0) {
      lines.push(
        kind === "group"
          ? "- _(no leader notes in this span yet)_"
          : "- _(no notes in this span yet)_",
      );
    } else {
      for (const question of section.questions) {
        const label = KIND_LABEL[question.kind] || question.kind;
        lines.push(`- **${label}.** ${question.text}`);
      }
    }
    lines.push("");
  }
  return `${lines.join("\n").replace(/\s+$/, "")}\n`;
}
