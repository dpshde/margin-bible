import { describe, expect, test } from "bun:test";
import {
  addAttachment,
  mergeParsedXrefs,
  normalizeAttachments,
  noteIsEmpty,
  parseAttachmentInput,
} from "../src/attachments";

describe("attachments", () => {
  test("parses a passage and a url", () => {
    const xref = parseAttachmentInput("John 3:16");
    expect(xref?.kind).toBe("xref");
    expect(xref && xref.kind === "xref" && xref.slug).toBe("jhn.3.16");

    const url = parseAttachmentInput("https://example.com/path");
    expect(url?.kind).toBe("url");
    expect(url && url.kind === "url" && url.url).toBe("https://example.com/path");
  });

  test("an http url stays an external ref when the path looks like a passage", () => {
    const route = parseAttachmentInput("https://route.bible/jhn.3.16");
    expect(route?.kind).toBe("url");
    expect(route && route.kind === "url" && route.url).toBe("https://route.bible/jhn.3.16");
    const www = parseAttachmentInput("www.example.com/note");
    expect(www?.kind).toBe("url");
    expect(www && www.kind === "url" && www.url.startsWith("https://www.example.com/note")).toBe(true);
    expect(parseAttachmentInput("John 3:16")?.kind).toBe("xref");
    expect(parseAttachmentInput("not a link")).toBeNull();
  });

  test("dedupes xref and url chips", () => {
    const { list, added } = addAttachment([], { kind: "xref", slug: "jhn.3.16", title: "John 3:16", source: "manual" });
    expect(added?.slug).toBe("jhn.3.16");
    const again = addAttachment(list, { kind: "xref", slug: "jhn.3.16", title: "dup" });
    expect(again.added).toBeNull();
    expect(again.list).toHaveLength(1);
  });

  test("scans wiki and natural refs from blocks into attachments", () => {
    const { list, added, changed } = mergeParsedXrefs([], [
      { text: "See [[rom.8.28]] and John 3:16" },
    ]);
    expect(changed).toBe(true);
    expect(added.length).toBeGreaterThanOrEqual(1);
    const slugs = list.filter((row) => row.kind === "xref").map((row) => row.slug);
    expect(slugs).toContain("rom.8.28");
    expect(slugs).toContain("jhn.3.16");
  });

  test("keeps manual xref when scan no longer finds it", () => {
    const manual = normalizeAttachments([
      { id: "att_abcd", kind: "xref", slug: "jhn.1.1", title: "John 1:1", source: "manual" },
    ]);
    const { list } = mergeParsedXrefs(manual, [{ text: "no refs here" }]);
    expect(list).toHaveLength(1);
    expect(list[0].kind === "xref" && list[0].source).toBe("manual");
  });

  test("drops scanned xref when text no longer mentions it", () => {
    const scanned = normalizeAttachments([
      { id: "att_abcd", kind: "xref", slug: "jhn.1.1", title: "John 1:1", source: "scan" },
    ]);
    const { list } = mergeParsedXrefs(scanned, [{ text: "cleared" }]);
    expect(list).toHaveLength(0);
  });


  test("keeps xref with missing source when text no longer mentions it", () => {
    const legacy = normalizeAttachments([
      { id: "att_abcd", kind: "xref", slug: "jhn.1.1", title: "John 1:1" },
    ]);
    const { list } = mergeParsedXrefs(legacy, [{ text: "cleared" }]);
    expect(list).toHaveLength(1);
  });

  test("suppressScanSlugs prevents resurrecting a dismissed chip from text", () => {
    const { list, added } = mergeParsedXrefs([], [{ text: "See John 3:16" }], {
      suppressScanSlugs: ["jhn.3.16"],
    });
    expect(added).toHaveLength(0);
    expect(list.filter((row) => row.kind === "xref" && row.slug === "jhn.3.16")).toHaveLength(0);
  });

  test("parseAttachmentInput tags passages as manual", () => {
    const xref = parseAttachmentInput("Romans 9:17");
    expect(xref?.kind).toBe("xref");
    expect(xref && "source" in xref && xref.source).toBe("manual");
  });
  test("noteIsEmpty respects bookmark and attachments", () => {
    expect(noteIsEmpty([{ text: "" }], [], false)).toBe(true);
    expect(noteIsEmpty([{ text: "" }], [], true)).toBe(false);
    expect(
      noteIsEmpty([{ text: "" }], [{ id: "att_abcd", kind: "url", url: "https://x.test", title: "x", source: "manual" }], false),
    ).toBe(false);
    expect(noteIsEmpty([{ text: "hi" }], [], false)).toBe(false);
  });
});
