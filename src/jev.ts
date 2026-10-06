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

/**
 * Titles Jev may return. The key is the title shown on the card.
 * Phrases are specific on purpose so neighboring passages do not
 * collapse into the same doctrine word.
 */
export const VERSE_TOPIC_CRITERIA: Record<string, string> = {
  "In the beginning": "The opening of creation, before the world was made.",
  "Let there be light": "God speaking light into the darkness.",
  "Made in God's image": "People created to reflect God.",
  "God saw that it was good": "Creation finished and called good.",
  "The heavens declare": "The sky telling the glory of God.",
  "The Word was God": "The Word's deity, with God in the beginning.",
  "All things made through him": "Creation coming into being through the Word.",
  "Light shines in the darkness": "Light that the darkness does not overcome.",
  "The Word made flesh": "The Word becoming human and dwelling among us.",
  "The lamb of God": "Jesus as the lamb who takes away sin.",
  "I am the bread of life": "Jesus as the bread that gives life.",
  "Living water": "Water Jesus gives that ends thirst.",
  "I am the light of the world": "Jesus as the light people follow.",
  "The good shepherd": "Jesus the shepherd who lays down his life.",
  "I am the resurrection": "Jesus as resurrection and life.",
  "I am the way": "Jesus as the way, the truth, and the life.",
  "Come to me": "Jesus calling the weary to rest.",
  "It is finished": "Jesus' word that the work of the cross is done.",
  "Christ died for sins": "Jesus dying in the place of sinners.",
  "He bore our sins": "Jesus carrying sins in his body.",
  "Raised on the third day": "Jesus risen from the dead on the third day.",
  "The empty tomb": "The tomb found empty after the resurrection.",
  "The Lord is my shepherd": "The Lord tending his people as a shepherd.",
  "I shall not want": "The shepherd supplying what is needed.",
  "He leads me beside still waters": "The shepherd leading into rest.",
  "The valley of the shadow": "Walking through the valley of the shadow of death.",
  "Goodness and mercy follow": "Goodness and mercy pursuing the psalmist.",
  "Nothing can separate": "Nothing separating God's people from his love.",
  "All things for good": "God working all things for good for those who love him.",
  "More than conquerors": "The people of God conquering through the one who loved them.",
  "The Spirit intercedes": "The Spirit groaning and praying for the saints.",
  "If God is for us": "God on the side of his people, against every charge.",
  "No condemnation": "No condemnation for those in Christ Jesus.",
  "Groaning for redemption": "Creation and the saints groaning for the redemption of the body.",
  "Saved by grace through faith": "Salvation as a gift, received by faith.",
  "Not by works": "Salvation that is not earned by works.",
  "Dead in trespasses": "People dead in sin before God makes them alive.",
  "Raised and seated with Christ": "God raising his people and seating them with Christ.",
  "While we were still sinners": "Christ dying for people while they were still sinners.",
  "Justified by faith": "Being counted righteous by faith, apart from works.",
  "The righteousness of God": "God's own righteousness revealed, not a wage.",
  "All have sinned": "Every person falling short of the glory of God.",
  "The wages of sin": "Sin paying out death.",
  "The gift of God is eternal life": "Eternal life as God's gift, not a wage.",
  "Poor in spirit": "The poor in spirit, and the kingdom that is theirs.",
  "Those who mourn": "Blessing for those who mourn.",
  "Blessed are the meek": "The meek inheriting the earth.",
  "Hunger and thirst for righteousness": "Those who hunger and thirst to be made right.",
  "Blessed are the peacemakers": "Peacemakers called children of God.",
  "Salt and light": "Disciples as salt of the earth and light of the world.",
  "Your kingdom come": "Praying for God's kingdom to come.",
  "Seek first the kingdom": "Seeking God's kingdom ahead of other needs.",
  "The Lord reigns": "God reigning as king.",
  "I raised you up": "God raising a ruler so his name is proclaimed.",
  "The potter and the clay": "The potter's right over the clay.",
  "He has mercy on whom he wills": "Mercy and hardening as God wills.",
  "For such a time as this": "A person placed where they are for this moment.",
  "I will be their God": "God binding himself to a people: I will be their God.",
  "A new covenant": "The new covenant written on the heart.",
  "Born of the Spirit": "New birth by the Spirit.",
  "The fruit of the Spirit": "Love, joy, peace, and the rest of the Spirit's fruit.",
  "Filled with the Spirit": "Being filled with the Spirit.",
  "The Spirit of truth": "The Spirit who guides into the truth.",
  "Ask, seek, knock": "Asking, seeking, and knocking in prayer.",
  "The Lord's prayer": "The prayer Jesus taught his disciples.",
  "The fear of the Lord": "Wisdom that begins in the fear of the Lord.",
  "Trust in the Lord": "Trusting the Lord rather than one's own understanding.",
  "Your word is a lamp": "God's word lighting the path.",
  "Faith comes by hearing": "Faith arising from hearing the word of Christ.",
  "All scripture is God-breathed": "Scripture breathed out by God and useful.",
  "God opposes the proud": "God opposing the proud and giving grace to the humble.",
  "Humble yourselves": "Humbling oneself under God's mighty hand.",
  "Cast your cares on him": "Throwing anxieties onto God because he cares.",
  "Consider it joy": "Counting a trial as joy.",
  "A thorn in the flesh": "A weakness or thorn that grace is enough for.",
  "Weeping may last the night": "Sorrow that gives way to joy in the morning.",
  "Hope that does not disappoint": "Hope that will not put the people of God to shame.",
  "The God of all comfort": "God comforting his people in affliction.",
  "One body, many members": "The church as one body with many members.",
  "Love one another": "The command to love one another.",
  "Bear one another's burdens": "Carrying each other's burdens.",
  "The household of God": "The church as God's household.",
  "Run with endurance": "Laying aside every weight and running the race set before us.",
  "Cloud of witnesses": "The crowd of faithful witnesses surrounding the race.",
  "The Lord disciplines those he loves": "The Lord's discipline of the children he loves.",
  "Discipline yields a harvest": "Discipline training people into a harvest of righteousness.",
  "Rejoice in suffering": "Rejoicing in suffering because it produces endurance.",
  "Suffering produces perseverance": "Suffering producing perseverance, character, and hope.",
  "The rich man and Lazarus": "The rich man and the poor man at his gate.",
  "A great chasm fixed": "A chasm fixed so no one can cross.",
  "Content in every circumstance": "Learning contentment in plenty and in need.",
  "I can do all things through him": "Strength for every circumstance through Christ.",
  "The peace of God": "The peace of God guarding heart and mind.",
  "Do not be anxious": "Refusing anxiety and making requests known to God.",
  "Rejoice in the Lord always": "The call to rejoice in the Lord always.",
  "The assurance of faith": "Faith as assurance of what is hoped for.",
  "By faith Abraham obeyed": "Abraham obeying when he was called, by faith.",
  "Faith without works": "Faith that is dead when it has no works.",
  "We walk by faith": "Walking by faith and not by sight.",
  "Fight the good fight": "Fighting the good fight and keeping the faith.",
  "The lost sheep": "The shepherd leaving the ninety-nine for the one.",
  "The prodigal son": "A son who was lost and then found.",
  "A house built on the rock": "Hearing Jesus' words and doing them.",
  "The narrow gate": "The narrow gate that leads to life.",
  "Take up your cross": "Denying oneself and taking up the cross.",
  "Abide in me": "Remaining in Christ as a branch in the vine.",
  "I am the vine": "Jesus the vine, his people the branches.",
  "Crucified with Christ": "No longer I who live, but Christ who lives in me.",
  "A new creation": "Anyone in Christ being a new creation.",
  "The armor of God": "Putting on the armor of God to stand.",
  "The tongue is a fire": "The tongue as a fire that sets a life ablaze.",
  "Store up treasures in heaven": "Treasures in heaven rather than on earth.",
  "You cannot serve two masters": "No one serving both God and money.",
  "The least of these": "Serving Jesus by serving the least of his brothers.",
  "Love your enemies": "Loving enemies and praying for those who persecute.",
  "The Lord is my light": "The Lord as light and salvation, whom shall I fear.",
  "Be still and know": "Being still and knowing that the Lord is God.",
  "Create in me a clean heart": "Asking God for a clean heart and a right spirit.",
  "The Lord is near the brokenhearted": "The Lord staying near the brokenhearted.",
  "How long, O Lord": "A cry of how long in the midst of trouble.",
  "By his wounds we are healed": "Healing through the wounds of the servant.",
  "A bruised reed": "A bruised reed he will not break.",
  "He will wipe every tear": "God wiping every tear from their eyes.",
  "Worthy is the Lamb": "The Lamb who was slain, worthy of worship.",
  "Go and make disciples": "The commission to make disciples of all nations.",
  "You are a chosen people": "A people chosen, royal, and holy.",
  "Repent and believe": "The call to repent and believe the good news.",
  "Return to me": "God calling his people to return to him.",
  "A broken and contrite heart": "The sacrifice of a broken and contrite heart.",
  "The day of the Lord": "The day of the Lord's coming and accounting.",
  "God will judge": "God judging the living and the dead, or a people.",
  "Let my people go": "God demanding that his people be let go.",
  "I am who I am": "God naming himself I AM.",
  "The passover lamb": "The lamb whose blood marks the houses.",
  "Manna in the wilderness": "Bread from heaven in the wilderness.",
  "The promised land": "The land God swore to give.",
  "Sing to the Lord": "A call to sing praise to the Lord.",
  None: "No listed topic is close to these verses.",
};

export const VERSE_TOPIC_INSTRUCTIONS =
  "Which one short title best names what these verses say together? Prefer a specific pastoral title over a broad umbrella. Prefer the narrower title when a broad one and a specific one both fit. Do not default to a single doctrine word. Choose None only when no title is close.";

const NONE_TOPIC = "None";

function normalizedTitle(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Titles already on other groups, compared without case. */
export function takenTitleKeys(takenTitles: readonly string[]): Set<string> {
  const taken = new Set<string>();
  for (const raw of takenTitles) {
    const title = normalizedTitle(raw).toLowerCase();
    if (title && title !== "none") taken.add(title);
  }
  return taken;
}

/** Drop titles the library already uses so the next group cannot repeat them. */
export function criteriaAvoiding(takenTitles: readonly string[] = []): Record<string, string> {
  const taken = takenTitleKeys(takenTitles);
  if (taken.size === 0) return VERSE_TOPIC_CRITERIA;
  const criteria: Record<string, string> = {};
  for (const [key, value] of Object.entries(VERSE_TOPIC_CRITERIA)) {
    if (key !== NONE_TOPIC && taken.has(key.toLowerCase())) continue;
    criteria[key] = value;
  }
  criteria[NONE_TOPIC] = VERSE_TOPIC_CRITERIA[NONE_TOPIC];
  return criteria;
}

export function verseTopicInstructions(takenTitles: readonly string[] = []): string {
  const taken = takenTitleKeys(takenTitles);
  if (taken.size === 0) return VERSE_TOPIC_INSTRUCTIONS;
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const raw of takenTitles) {
    const title = normalizedTitle(raw);
    const key = title.toLowerCase();
    if (!title || !taken.has(key) || seen.has(key)) continue;
    seen.add(key);
    labels.push(title);
  }
  return `${VERSE_TOPIC_INSTRUCTIONS} These titles are already used and must not be chosen: ${labels.join("; ")}.`;
}

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

export function jevTopicRequest(
  lines: readonly VerseLine[],
  takenTitles: readonly string[] = [],
): {
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
        instructions: verseTopicInstructions(takenTitles),
        criteria: criteriaAvoiding(takenTitles),
      },
    },
  };
}

export function topicFromJevBody(body: unknown, criteria: Record<string, string> = VERSE_TOPIC_CRITERIA): string | null {
  if (!body || typeof body !== "object") return null;
  const answers = (body as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object") return null;
  const topic = (answers as { topic?: unknown }).topic;
  if (!topic || typeof topic !== "object") return null;
  const choice = (topic as { choice?: unknown }).choice;
  if (typeof choice !== "string") return null;
  const title = choice.trim();
  if (!title || title === NONE_TOPIC || !Object.hasOwn(criteria, title)) return null;
  return title;
}

export async function nearestVerseTopic(
  lines: readonly VerseLine[],
  options: { apiKey?: string | null; fetchImpl?: typeof fetch; takenTitles?: readonly string[] } = {},
): Promise<JevTopicResult> {
  const state = verseTopicState(lines);
  if (!state.verses.length) return { ok: false, status: 502, error: "Those verses have no text to read." };
  const apiKey = String(options.apiKey ?? "").trim();
  if (!apiKey) {
    return { ok: false, status: 503, error: "Topic suggestions need TYPESAFE_API_KEY on the worker." };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = jevTopicRequest(lines, options.takenTitles ?? []);
  try {
    const upstream = await fetchImpl(TYPESAFE_SYSTEMONE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(request),
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
    const topic = topicFromJevBody(parsed, request.questions.topic.criteria);
    if (!topic) return { ok: false, status: 502, error: "No close topic for these verses." };
    return { ok: true, topic };
  } catch {
    return { ok: false, status: 502, error: "Could not reach Jev." };
  }
}
