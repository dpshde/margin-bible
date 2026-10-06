/**
 * Nearest topic for a verse group, via TypeSafe Jev (System One).
 *
 * The worker posts the verse lines as `state` and a Choice question.
 * Jev returns one of the criteria keys. This does not score keywords
 * and does not import src/jev-topics.ts.
 *
 * Auth is the worker secret TYPESAFE_API_KEY (Bearer). The key is never
 * written into the page or the response. If it is unset, Jev is not called.
 */
export const TYPESAFE_SYSTEMONE_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";

/** Titles Jev may return. The key is the title; the value tells Jev what it covers. */
export const VERSE_TOPIC_CRITERIA: Record<string, string> = {
  Grace: "God's undeserved favor, a gift rather than a wage.",
  Faith: "Trusting God and taking him at his word.",
  Love: "God's love, or the love owed to God and neighbor.",
  Mercy: "Compassion that does not give what is deserved.",
  Hope: "Confidence in what God has promised.",
  Salvation: "God rescuing and saving a people.",
  Justification: "Being counted righteous before God.",
  Righteousness: "What is right in God's sight, his or ours.",
  Sin: "Guilt, rebellion, or falling short of God.",
  Repentance: "Turning from sin back to God.",
  Forgiveness: "God pardoning guilt.",
  Judgment: "God's verdict, wrath, or accounting.",
  "Sovereignty of God": "God ruling, raising up, and disposing as he wills.",
  Providence: "God governing events toward his purpose.",
  "The love of God": "God's steadfast love holding his people.",
  Christ: "Jesus himself, his person and work.",
  "The cross": "Christ's death for sin.",
  Resurrection: "Christ or his people raised from the dead.",
  "The Spirit": "The Holy Spirit's presence and work.",
  "The Word": "God's word, or the Word who was with God.",
  Prayer: "Asking God, praise, or crying out to him.",
  Wisdom: "Skill to live in the fear of the Lord.",
  Humility: "Lowering oneself under God's hand.",
  Suffering: "Affliction, weakness, or a trial endured.",
  Covenant: "God binding himself to a people by promise.",
  Kingdom: "God's reign, present or coming.",
  Holiness: "God's otherness, or a people set apart.",
  Creation: "God making and sustaining the world.",
  None: "No listed topic is close to these verses.",
};

const NONE_TOPIC = "None";

export type VerseLine = { label: string; text: string };

export type JevTopicResult =
  | { ok: true; topic: string }
  | { ok: false; status: 502 | 503; error: string };

export function verseTopicState(lines: readonly VerseLine[]): { verses: { ref: string; text: string }[] } {
  return {
    verses: lines
      .map((line) => ({ ref: line.label.trim(), text: line.text.replace(/\s+/g, " ").trim() }))
      .filter((line) => line.ref && line.text),
  };
}

export function jevTopicRequest(lines: readonly VerseLine[]): {
  model: string;
  state: { verses: { ref: string; text: string }[] };
  questions: {
    topic: { type: "choice"; instructions: string; criteria: Record<string, string> };
  };
} {
  return {
    model: JEV_MODEL,
    state: verseTopicState(lines),
    questions: {
      topic: {
        type: "choice",
        instructions:
          "Which one topic best names what these verses say together? Choose the nearest topic. Choose None only when no topic is close.",
        criteria: VERSE_TOPIC_CRITERIA,
      },
    },
  };
}

export function topicFromJevBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const answers = (body as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object") return null;
  const topic = (answers as { topic?: unknown }).topic;
  if (!topic || typeof topic !== "object") return null;
  const choice = (topic as { choice?: unknown }).choice;
  if (typeof choice !== "string") return null;
  const title = choice.trim();
  if (!title || title === NONE_TOPIC || !Object.hasOwn(VERSE_TOPIC_CRITERIA, title)) return null;
  return title;
}

export async function nearestVerseTopic(
  lines: readonly VerseLine[],
  options: { apiKey?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<JevTopicResult> {
  const state = verseTopicState(lines);
  if (!state.verses.length) return { ok: false, status: 502, error: "Those verses have no text to read." };
  const apiKey = String(options.apiKey ?? "").trim();
  if (!apiKey) {
    return { ok: false, status: 503, error: "Topic suggestions need TYPESAFE_API_KEY on the worker." };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const upstream = await fetchImpl(TYPESAFE_SYSTEMONE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(jevTopicRequest(lines)),
      signal: AbortSignal.timeout(8000),
    });
    const text = await upstream.text();
    if (!upstream.ok) return { ok: false, status: 502, error: "Could not reach Jev." };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.split(apiKey).join(""));
    } catch {
      return { ok: false, status: 502, error: "Could not read Jev." };
    }
    const topic = topicFromJevBody(parsed);
    if (!topic) return { ok: false, status: 502, error: "No close topic for these verses." };
    return { ok: true, topic };
  } catch {
    return { ok: false, status: 502, error: "Could not reach Jev." };
  }
}
