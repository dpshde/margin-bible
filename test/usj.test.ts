import { describe, expect, test } from "bun:test";
import { packChapter, type UsjDocument } from "../src/usj";

const fixture: UsjDocument = {
  type: "USJ",
  version: "3.1",
  content: [
    { type: "para", marker: "mt1", content: ["John"] },
    { type: "chapter", marker: "c", number: "3" },
    { type: "para", marker: "s1", content: ["Jesus and Nicodemus"] },
    { type: "para", marker: "r", content: ["(Genesis 22:1–10)"] },
    {
      type: "para",
      marker: "p",
      content: [
        { type: "verse", marker: "v", number: "16" },
        "For God so loved the world ",
        {
          type: "char",
          marker: "wj",
          content: [
            "that He gave His Son",
            {
              type: "note",
              marker: "f",
              content: [{ type: "char", marker: "ft", content: ["should not appear"] }],
            },
          ],
        },
        ".",
      ],
    },
    { type: "chapter", marker: "c", number: "4" },
    {
      type: "para",
      marker: "p",
      content: [{ type: "verse", marker: "v", number: "1" }, "Chapter four starts here."],
    },
  ],
};

describe("USJ chapter pack", () => {
  test("flattens one chapter and drops footnotes", () => {
    const pack = packChapter("JHN", 3, fixture, "fixture");
    expect(pack).not.toBeNull();
    expect(pack!.verses).toHaveLength(1);
    expect(pack!.verses[0].heading).toBe("Jesus and Nicodemus");
    expect(pack!.verses[0].text).toBe("For God so loved the world that He gave His Son.");
    expect(pack!.verses[0].text.includes("should not appear")).toBe(false);
    expect(pack!.verses[0].text.includes("Genesis")).toBe(false);
  });

  test("does not leak the next chapter", () => {
    const pack = packChapter("JHN", 4, fixture, "fixture");
    expect(pack!.verses[0].text).toBe("Chapter four starts here.");
    expect(pack!.verses[0].heading).toBeUndefined();
  });

  test("inserts a space where a poetry line break was", () => {
    const psalm: UsjDocument = {
      type: "USJ",
      version: "3.1",
      content: [
        { type: "chapter", marker: "c", number: "94" },
        { type: "para", marker: "s1", content: ["The LORD Will Not Forget His People"] },
        {
          type: "para",
          marker: "q1",
          content: [" ", { type: "verse", marker: "v", number: "1" }, "O LORD, God of vengeance,"],
        },
        { type: "para", marker: "q2", content: ["O God of vengeance, shine forth."] },
        { type: "para", marker: "b" },
        {
          type: "para",
          marker: "q1",
          content: [" ", { type: "verse", marker: "v", number: "2" }, "Blessed is the man"],
        },
        { type: "para", marker: "q2", content: ["who does not walk in the counsel of the wicked,"] },
      ],
    };
    const pack = packChapter("PSA", 94, psalm, "fixture");
    expect(pack!.verses.map((verse) => verse.text)).toEqual([
      "O LORD, God of vengeance, O God of vengeance, shine forth.",
      "Blessed is the man who does not walk in the counsel of the wicked,",
    ]);
    expect(pack!.verses[0].heading).toBe("The LORD Will Not Forget His People");
    expect(pack!.verses[1].heading).toBeUndefined();
  });

  test("keeps a space where a footnote sat between two words", () => {
    const doc: UsjDocument = {
      type: "USJ",
      version: "3.1",
      content: [
        { type: "chapter", marker: "c", number: "1" },
        {
          type: "para",
          marker: "p",
          content: [
            { type: "verse", marker: "v", number: "20" },
            "She named him Samuel,",
            { type: "note", marker: "f", content: ["sounds like heard of God"] },
            "saying, “Because I asked.”",
          ],
        },
        {
          type: "para",
          marker: "p",
          content: [
            { type: "verse", marker: "v", number: "21" },
            "He said, “Go",
            { type: "note", marker: "f", content: ["footnote"] },
            ".” And the LORD said, “Tell Aaron and his sons:This is how.”",
          ],
        },
      ],
    };
    const pack = packChapter("1SA", 1, doc, "fixture");
    expect(pack!.verses[0].text).toBe("She named him Samuel, saying, “Because I asked.”");
    expect(pack!.verses[1].text).toBe("He said, “Go.” And the LORD said, “Tell Aaron and his sons: This is how.”");
  });
});
