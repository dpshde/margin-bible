import { describe, expect, test } from "bun:test";
import {
  JEV_MODEL,
  TYPESAFE_SYSTEMONE_URL,
  VERSE_TOPIC_CRITERIA,
  VERSE_TOPIC_INSTRUCTIONS,
  jevTopicRequest,
  nearestVerseTopic,
  topicFromJevBody,
} from "../src/jev";
import { bsbLinesForSlugs } from "../src/verse-text";

describe("Jev verse topic", () => {
  test("the request sends verse lines to System One and does not use keyword lists", () => {
    const body = jevTopicRequest([
      { label: "Romans 8:28", text: "And we know that God works all things together for the good of those who love Him." },
      { label: "Romans 8:39", text: "neither height nor depth, nor anything else in all creation." },
    ]);
    expect(body.model).toBe(JEV_MODEL);
    expect(body.state.verses.map((verse) => verse.ref)).toEqual(["Romans 8:28", "Romans 8:39"]);
    expect(body.questions.topic.type).toBe("choice");
    expect(body.questions.topic.criteria).toBe(VERSE_TOPIC_CRITERIA);
    expect(body.questions.topic.instructions).toBe(VERSE_TOPIC_INSTRUCTIONS);
    expect(VERSE_TOPIC_INSTRUCTIONS).toContain("narrower");
    expect(VERSE_TOPIC_INSTRUCTIONS).toContain("specific pastoral");
    const titles = Object.keys(VERSE_TOPIC_CRITERIA);
    expect(titles.length).toBeGreaterThan(60);
    expect(titles.length).toBeLessThanOrEqual(255);
    expect(titles).toContain("Nothing can separate");
    expect(titles).toContain("The Lord is my shepherd");
    expect(titles).toContain("Poor in spirit");
    expect(titles).toContain("Saved by grace through faith");
    expect(titles).toContain("The Word made flesh");
    expect(titles).toContain("For such a time as this");
    expect(titles).toContain("Run with endurance");
    expect(titles).toContain("Rejoice in suffering");
    expect(titles).toContain("The Lord disciplines those he loves");
    expect(titles).toContain("Content in every circumstance");
    expect(titles).not.toContain("Grace");
    expect(titles).not.toContain("Faith");
    expect(titles).not.toContain("Suffering");
    expect(titles).not.toContain("Sovereignty of God");
    expect(titles).not.toContain("Providence");
    expect(titles.every((title) => title.length > 0 && title.length <= 120)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("pharaoh");
    expect(JSON.stringify(body)).not.toContain("jev-topics");
  });

  test("the choice title is kept and None is refused", () => {
    expect(topicFromJevBody({ answers: { topic: { type: "choice", choice: "For such a time as this", confidence: 0.8 } } })).toBe(
      "For such a time as this",
    );
    const avoided = jevTopicRequest(
      [{ label: "Esther 4:14", text: "And who knows whether you have not come to the kingdom for such a time as this?" }],
      ["The Lord is my shepherd", " faith "],
    );
    expect(avoided.questions.topic.criteria).not.toHaveProperty("The Lord is my shepherd");
    expect(avoided.questions.topic.criteria).toHaveProperty("None");
    expect(avoided.questions.topic.instructions).toContain("The Lord is my shepherd");
    expect(avoided.questions.topic.instructions).toContain("faith");
    expect(topicFromJevBody(
      { answers: { topic: { type: "choice", choice: "The Lord is my shepherd" } } },
      avoided.questions.topic.criteria,
    )).toBeNull();
    expect(topicFromJevBody({ answers: { topic: { type: "choice", choice: "None" } } })).toBeNull();
    expect(topicFromJevBody({ answers: { topic: { type: "choice", choice: "Not a topic" } } })).toBeNull();
  });

  test("a missing key does not call Jev", async () => {
    let called = false;
    const result = await nearestVerseTopic([{ label: "John 1:1", text: "In the beginning was the Word." }], {
      apiKey: "",
      fetchImpl: () => {
        called = true;
        return Promise.resolve(new Response(""));
      },
    });
    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("TYPESAFE_API_KEY");
  });

  test("a live-shaped response becomes the title", async () => {
    const seen: { url: string; authorization: string; body: string }[] = [];
    const result = await nearestVerseTopic([{ label: "John 1:1", text: "In the beginning was the Word." }], {
      apiKey: "secret-key",
      fetchImpl: (url, init) => {
        seen.push({
          url: String(url),
          authorization: String((init?.headers as Record<string, string>).authorization),
          body: String(init?.body),
        });
        return Promise.resolve(
          Response.json({
            model: "jev-1.13.0",
            answers: { topic: { type: "choice", choice: "The Word made flesh", confidence: 0.9, probabilities: {} } },
            usage: { input_tokens: 10, output_tokens: 1 },
          }),
        );
      },
    });
    expect(result).toEqual({ ok: true, topic: "The Word made flesh" });
    expect(seen[0]?.url).toBe(TYPESAFE_SYSTEMONE_URL);
    expect(seen[0]?.authorization).toBe("Bearer secret-key");
    expect(seen[0]?.body).toContain("In the beginning was the Word.");
    expect(seen[0]?.body).not.toContain("secret-key");
  });
});

describe("BSB lines for a group", () => {
  test("hub and members come back in member order", async () => {
    const assets = {
      async fetch(input: URL | RequestInfo) {
        const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL(input.url);
        if (url.pathname === "/bsb/jhn.1.json") {
          return Response.json({
            verses: [
              { v: 1, text: "In the beginning was the Word." },
              { v: 3, text: "Through Him all things were made." },
            ],
          });
        }
        return new Response("missing", { status: 404 });
      },
    };
    const lines = await bsbLinesForSlugs(assets, ["jhn.1.1", "jhn.1.3", "jhn.1.99"]);
    expect(lines).toEqual([
      { label: "John 1:1", text: "In the beginning was the Word." },
      { label: "John 1:3", text: "Through Him all things were made." },
    ]);
  });
});
