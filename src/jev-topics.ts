/**
 * Two-step topic choice for a verse web.
 * Parents come first. Children appear only after a parent is chosen.
 * The nearest topic is the child whose words show up in the most passages.
 */
import type { VerseGroupView } from "./verse-groups";

export type JevTopicChild = {
  label: string;
  terms: string[];
};

export type JevTopicParent = {
  id: string;
  label: string;
  children: JevTopicChild[];
};

export type JevTopicMatch = {
  parentId: string;
  parent: string;
  child: string;
  passages: number;
  hits: number;
};

/** BSB wording for the seed web, used when the chapter assets are not in play. */
export const DEMO_VERSE_TEXTS = [
  "For the Scripture says to Pharaoh: “I raised you up for this very purpose, that I might display My power in you, and that My name might be proclaimed in all the earth.”",
  "Humble yourselves, therefore, under God’s mighty hand, so that in due time He may exalt you.",
  "For if you remain silent at this time, relief and deliverance for the Jews will arise from another place, but you and your father’s house will perish. And who knows if perhaps you have come to the kingdom for such a time as this?”",
  "Jesus answered, “Neither this man nor his parents sinned, but this happened so that the works of God would be displayed in him.",
  "For by the grace given me I say to every one of you: Do not think of yourself more highly than you ought, but think of yourself with sober judgment, according to the measure of faith God has given you.",
] as const;

export const JEV_TOPICS: readonly JevTopicParent[] = [
  {
    id: "god",
    label: "God",
    children: [
      { label: "Sovereignty of God", terms: ["pharaoh", "power", "proclaimed", "raised"] },
      { label: "Providence", terms: ["deliverance", "arise", "kingdom", "relief", "purpose", "works"] },
      { label: "Grace", terms: ["grace", "measure"] },
      { label: "Mercy", terms: ["mercy", "compassion"] },
    ],
  },
  {
    id: "character",
    label: "Character",
    children: [
      { label: "Humility", terms: ["humble", "humility", "exalt", "highly", "sober"] },
      { label: "Faith", terms: ["faith", "believe"] },
      { label: "Wisdom", terms: ["wisdom", "wise"] },
      { label: "Love", terms: ["love", "loved"] },
    ],
  },
  {
    id: "life",
    label: "Life",
    children: [
      { label: "Judgment", terms: ["judgment", "sinned", "perish"] },
      { label: "Suffering", terms: ["suffer", "affliction", "trial"] },
      { label: "Hope", terms: ["hope"] },
      { label: "Repentance", terms: ["repent", "repentance"] },
    ],
  },
];

function termHit(text: string, term: string): boolean {
  const needle = term.toLowerCase();
  if (needle.includes(" ")) return text.toLowerCase().includes(needle);
  return new RegExp(`\\b${needle}\\b`, "i").test(text);
}

function scoreChild(texts: readonly string[], terms: readonly string[]): { passages: number; hits: number } {
  let passages = 0;
  let hits = 0;
  for (const text of texts) {
    let found = 0;
    for (const term of terms) {
      if (termHit(text, term)) found += 1;
    }
    if (found > 0) passages += 1;
    hits += found;
  }
  return { passages, hits };
}

/** Nearest child. More passages win, then more word hits, then earlier in the tree. */
export function closestJevTopic(texts: readonly string[]): JevTopicMatch | null {
  const usable = texts.map((text) => text.trim()).filter(Boolean);
  if (!usable.length) return null;
  let best: JevTopicMatch | null = null;
  for (const parent of JEV_TOPICS) {
    for (const child of parent.children) {
      const score = scoreChild(usable, child.terms);
      if (score.passages === 0) continue;
      const match: JevTopicMatch = {
        parentId: parent.id,
        parent: parent.label,
        child: child.label,
        passages: score.passages,
        hits: score.hits,
      };
      if (
        !best ||
        match.passages > best.passages ||
        (match.passages === best.passages && match.hits > best.hits)
      ) {
        best = match;
      }
    }
  }
  return best;
}

export function applySuggestedTopic(group: VerseGroupView, texts: readonly string[]): VerseGroupView {
  if (group.title.trim()) return group;
  const match = closestJevTopic(texts);
  if (!match) return group;
  return { ...group, suggestedTitle: match.child, topicParent: match.parentId };
}
