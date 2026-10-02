import { describe, expect, test } from "bun:test";
import type { Attachment } from "../src/attachments";
import {
  backlinkLoadSlugs,
  planXrefBacklinks,
  type BacklinkNote,
  type BacklinkOp,
} from "../src/xref-backlinks";

function ids() {
  let attachment = 0;
  let block = 0;
  return {
    attachment: () => {
      attachment += 1;
      return `att_${attachment}`;
    },
    block: () => {
      block += 1;
      return `b_${block}`;
    },
  };
}

function xref(slug: string, source?: "manual" | "scan" | "backlink"): Attachment {
  const row: Attachment = { id: `att_${slug}`, kind: "xref", slug, title: slug };
  if (source) row.source = source;
  return row;
}

function note(text: string, attachments: Attachment[] = [], bookmarked = false): BacklinkNote {
  return {
    blocks: [{ id: "b_keep", indent: 0, text, bullet: true }],
    bookmarked,
    attachments,
  };
}

function plan(input: {
  origin: string;
  previous?: Attachment[];
  next?: Attachment[];
  notes?: Map<string, BacklinkNote | null>;
}): BacklinkOp[] {
  return planXrefBacklinks({
    origin: input.origin,
    previous: input.previous ?? [],
    next: input.next ?? [],
    notes: input.notes ?? new Map(),
    label: (slug) => `label:${slug}`,
    ids: ids(),
  });
}

function saved(ops: BacklinkOp[], slug: string) {
  const op = ops.find((row) => row.op === "save" && row.note.slug === slug);
  if (!op || op.op !== "save") throw new Error(`missing save for ${slug}`);
  return op.note;
}

describe("planXrefBacklinks", () => {
  test("a manual xref creates a chip-only mirror on the other passage", () => {
    const ops = plan({ origin: "jhn.3.16", next: [xref("jhn.3.17", "manual")] });
    expect(ops).toHaveLength(1);
    const mirror = saved(ops, "jhn.3.17");
    expect(mirror.kind).toBe("verse");
    expect(mirror.book).toBe("JHN");
    expect(mirror.chapter).toBe(3);
    expect(mirror.verseStart).toBe(17);
    expect(mirror.verseEnd).toBeNull();
    expect(mirror.bookmarked).toBe(false);
    expect(mirror.blocks).toEqual([{ id: "b_1", indent: 0, text: "", bullet: true }]);
    expect(mirror.attachments).toEqual([
      { id: "att_1", kind: "xref", slug: "jhn.3.16", title: "label:jhn.3.16", source: "backlink" },
    ]);
  });

  test("a scanned xref and a legacy xref with no source also create mirrors", () => {
    const scanned = plan({ origin: "jhn.3.16", next: [xref("rom.8.1", "scan")] });
    const legacy = plan({ origin: "jhn.3.16", next: [xref("rom.8.28")] });
    expect(saved(scanned, "rom.8.1").attachments[0]).toMatchObject({ source: "backlink", slug: "jhn.3.16" });
    expect(saved(legacy, "rom.8.28").attachments[0]).toMatchObject({ source: "backlink", slug: "jhn.3.16" });
  });

  test("an existing xref back to the origin is left alone", () => {
    const target = note("already", [xref("jhn.3.16", "manual")]);
    const ops = plan({
      origin: "jhn.3.16",
      next: [xref("jhn.3.17", "scan")],
      notes: new Map([["jhn.3.17", target]]),
    });
    expect(ops).toEqual([]);
  });

  test("a mirror that already points back is not rewritten", () => {
    const target = note("", [xref("jhn.3.16", "backlink")]);
    const ops = plan({
      origin: "jhn.3.16",
      previous: [xref("jhn.3.17", "manual")],
      next: [xref("jhn.3.17", "manual")],
      notes: new Map([["JHN.3.17", target]]),
    });
    expect(ops).toEqual([]);
  });

  test("removing the user xref deletes an otherwise empty mirror", () => {
    const ops = plan({
      origin: "jhn.3.16",
      previous: [xref("jhn.3.17", "manual")],
      next: [],
      notes: new Map([["jhn.3.17", note("", [xref("jhn.3.16", "backlink")])] ]),
    });
    expect(ops).toEqual([{ op: "delete", slug: "jhn.3.17" }]);
  });

  test("removing the user xref only takes the mirror chip off a note that still has text", () => {
    const link: Attachment = {
      id: "att_url",
      kind: "url",
      url: "https://example.com",
      title: "Example",
      source: "manual",
    };
    const ops = plan({
      origin: "jhn.3.16",
      previous: [xref("jhn.3.17", "scan")],
      next: [],
      notes: new Map([["jhn.3.17", note("keep me", [link, xref("jhn.3.16", "backlink")])] ]),
    });
    const kept = saved(ops, "jhn.3.17");
    expect(kept.blocks[0].text).toBe("keep me");
    expect(kept.attachments).toEqual([link]);
  });

  test("removing the user xref does not remove the other note's own xref", () => {
    const ops = plan({
      origin: "jhn.3.16",
      previous: [xref("jhn.3.17", "manual")],
      next: [],
      notes: new Map([["jhn.3.17", note("ours", [xref("jhn.3.16", "manual")])] ]),
    });
    expect(ops).toEqual([]);
  });

  test("dismissing a mirror removes the other note's user xref and keeps its text", () => {
    const ops = plan({
      origin: "jhn.3.17",
      previous: [xref("jhn.3.16", "backlink")],
      next: [],
      notes: new Map([["jhn.3.16", note("see the other verse", [xref("jhn.3.17", "scan")])] ]),
    });
    const origin = saved(ops, "jhn.3.16");
    expect(origin.blocks[0].text).toBe("see the other verse");
    expect(origin.attachments).toEqual([]);
  });

  test("dismissing a mirror does not remove a mirror chip on the other note", () => {
    const ops = plan({
      origin: "jhn.3.17",
      previous: [xref("jhn.3.16", "backlink")],
      next: [],
      notes: new Map([["jhn.3.16", note("still", [xref("jhn.3.17", "backlink")])] ]),
    });
    expect(ops).toEqual([]);
  });

  test("a backlink does not create a mirror of itself", () => {
    const ops = plan({
      origin: "jhn.3.16",
      next: [xref("jhn.3.17", "backlink")],
    });
    expect(ops).toEqual([]);
  });

  test("a self xref and an unparseable slug are skipped", () => {
    const ops = plan({
      origin: "jhn.3.16",
      next: [xref("jhn.3.16", "manual"), xref("not a passage", "manual"), xref("john.3.16", "manual")],
    });
    expect(ops).toEqual([]);
  });

  test("a bookmarked mirror is saved instead of deleted", () => {
    const ops = plan({
      origin: "jhn.3.16",
      previous: [xref("jhn.3.17", "manual")],
      next: [],
      notes: new Map([["jhn.3.17", note("", [xref("jhn.3.16", "backlink")], true)]]),
    });
    const kept = saved(ops, "jhn.3.17");
    expect(kept.bookmarked).toBe(true);
    expect(kept.attachments).toEqual([]);
    expect(ops.some((row) => row.op === "delete")).toBe(false);
  });

  test("range and chapter targets keep their passage shape", () => {
    const ops = plan({
      origin: "psa.23.1",
      next: [xref("jhn.3.16-18", "manual"), xref("rom.8", "scan")],
    });
    const range = saved(ops, "jhn.3.16-18");
    expect(range.kind).toBe("range");
    expect(range.verseStart).toBe(16);
    expect(range.verseEnd).toBe(18);
    const chapter = saved(ops, "rom.8");
    expect(chapter.kind).toBe("chapter");
    expect(chapter.verseStart).toBeNull();
    expect(chapter.verseEnd).toBeNull();
    expect(chapter.book).toBe("ROM");
  });

  test("turning a mirror into the owning xref moves the mirror onto the other note", () => {
    const ops = plan({
      origin: "jhn.3.16",
      previous: [xref("jhn.3.17", "backlink")],
      next: [xref("jhn.3.17", "manual")],
      notes: new Map([["jhn.3.17", note("owned here", [xref("jhn.3.16", "manual")])] ]),
    });
    const moved = saved(ops, "jhn.3.17");
    expect(moved.blocks[0].text).toBe("owned here");
    expect(moved.attachments).toEqual([
      { id: "att_1", kind: "xref", slug: "jhn.3.16", title: "label:jhn.3.16", source: "backlink" },
    ]);
  });
});

describe("backlinkLoadSlugs", () => {
  test("loads the other passage for new links, removed links, and dismissed mirrors", () => {
    const slugs = backlinkLoadSlugs(
      "jhn.3.16",
      [xref("jhn.3.17", "manual"), xref("rom.8.1", "backlink"), xref("jhn.3.16", "manual")],
      [xref("psa.23.1", "scan"), xref("nope", "manual")],
    );
    expect(slugs.sort()).toEqual(["jhn.3.17", "psa.23.1", "rom.8.1"]);
  });
});
