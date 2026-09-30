import { describe, expect, test } from "bun:test";
import { displayTokens, resolveWikiTarget, wikiRaw, wikiTokens } from "../src/wiki-markup";

describe("wiki-markup (Rails parity via grab-bcv)", () => {
  test("resolves natural and OSIS targets", () => {
    const john = resolveWikiTarget("John 3:16");
    expect(john?.slug).toBe("jhn.3.16");
    expect(john?.href).toBe("/jhn.3.16?xref=1");
    expect(john?.label).toBe("John 3:16");

    const osis = resolveWikiTarget("jhn.1.6");
    expect(osis?.slug).toBe("jhn.1.6");
    expect(osis?.href).toBe("/jhn.1.6?xref=1");
    expect(osis?.label).toBe("John 1:6");

    expect(resolveWikiTarget("not a verse")).toBeNull();
  });

  test("tokenizes [[wiki]] and natural refs", () => {
    const tokens = wikiTokens("See [[jhn.1.6|the Baptist]] and [[John 1]] end");
    expect(tokens[0]).toEqual({ type: "text", value: "See " });
    expect(tokens[1].type).toBe("wiki");
    expect(tokens[1].href).toBe("/jhn.1.6?xref=1");
    expect(tokens[1].label).toBe("the Baptist");
    expect(tokens[1].raw).toBe("[[jhn.1.6|the Baptist]]");
    expect(tokens[3].slug).toBe("jhn.1");
    expect(tokens[3].href).toBe("/jhn.1");

    const natural = wikiTokens("See John 3:16 and Romans 8:28 end");
    expect(natural[1].type).toBe("wiki");
    expect(natural[1].raw).toBe("John 3:16");
    expect(natural[1].href).toBe("/jhn.3.16?xref=1");
    expect(natural[3].slug).toBe("rom.8.28");
  });

  test("skips refs inside code spans", () => {
    const tokens = wikiTokens("See **John** and `John 3:16` here");
    expect(tokens.some((t) => t.type === "wiki")).toBe(false);
  });

  test("displayTokens mixes markdown and wiki", () => {
    const tokens = displayTokens("See John 3:16 and **Word**");
    expect(tokens[1].type).toBe("wiki");
    expect(tokens[3]).toEqual({ type: "strong", value: "Word" });
  });

  test("wikiRaw", () => {
    expect(wikiRaw("jhn.1.6", "John")).toBe("[[jhn.1.6|John]]");
    expect(wikiRaw("jhn.1")).toBe("[[jhn.1]]");
  });

  test("en-dash ranges", () => {
    const tokens = wikiTokens("Cf. jhn.1.6 and John 3:16–18");
    expect(tokens[1].slug).toBe("jhn.1.6");
    expect(tokens[3].slug).toBe("jhn.3.16-18");
    expect(tokens[3].raw).toBe("John 3:16–18");
  });
});
