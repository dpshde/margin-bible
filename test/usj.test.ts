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
});
