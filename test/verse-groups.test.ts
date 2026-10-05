import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Attachment } from "../src/attachments";
import { page } from "../src/html";
import { renderNotesIndex } from "../src/reader-page";
import {
  DEMO_HUB,
  DEMO_SPOKE_SLUGS,
  PAIR_FILL_CAP,
  cleanGroupDescription,
  cleanGroupTitle,
  missingPairwise,
  realVerseGroups,
  userEdges,
  verseGroupsFromNotes,
  withManualXref,
  withoutUserXref,
  type GroupNote,
} from "../src/verse-groups";
import { verseGroupCardHtml, verseGroupsScript } from "../src/verse-groups-ui";

function xref(slug: string, source: "manual" | "scan" | "backlink" = "manual"): Attachment {
  return { id: "att_abcd1234", kind: "xref", slug, title: slug, source };
}

function note(slug: string, attachments: Attachment[]): GroupNote {
  return { slug, attachments };
}

function nodeCheck(source: string) {
  const path = join(tmpdir(), `margin-verse-groups-${process.pid}.js`);
  writeFileSync(path, source);
  try {
    const result = spawnSync("node", ["--check", path], { encoding: "utf8" });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  } finally {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

describe("verse group detection", () => {
  test("four spokes into Romans 9:17 are one fan-in web", () => {
    const notes = DEMO_SPOKE_SLUGS.map((slug) => note(slug, [xref(DEMO_HUB)]));
    const groups = verseGroupsFromNotes(notes);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.sample).toBe(false);
    expect(group.seed).toBe(true);
    expect(group.hub).toBe("rom.9.17");
    expect(group.hubLabel).toBe("Romans 9:17");
    expect(group.trigger).toBe("fan-in");
    expect(group.inboundCount).toBe(4);
    expect(group.why).toBe("4 notes point at Romans 9:17.");
    expect(group.members.map((member) => member.label)).toEqual([
      "Romans 9:17",
      "1 Peter 5:6",
      "Esther 4:14",
      "John 9:3",
      "Romans 12:3",
    ]);
    expect(group.members[0]?.role).toBe("hub");
    expect(group.missingCount).toBe(6);
    expect(group.missingPairs).toHaveLength(6);
    expect(group.missingPairs.some((pair) => pair.from === DEMO_HUB || pair.to === DEMO_HUB)).toBe(false);
  });

  test("an empty library shows the Romans 9:17 sample and does not invent other hubs", () => {
    const groups = verseGroupsFromNotes([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.sample).toBe(true);
    expect(groups[0]?.hub).toBe(DEMO_HUB);
    expect(groups[0]?.title).toBe("");
    expect(realVerseGroups([])).toEqual([]);
  });

  test("backlink mirrors are not fan-in and are not a star", () => {
    const hub = note(DEMO_HUB, [
      xref("1pe.5.6", "backlink"),
      xref("est.4.14", "backlink"),
      xref("jhn.9.3", "backlink"),
    ]);
    expect(userEdges([hub])).toEqual([]);
    expect(realVerseGroups([hub])).toEqual([]);
  });

  test("one inbound note does not surface a hub", () => {
    expect(realVerseGroups([note("1pe.5.6", [xref(DEMO_HUB)])])).toEqual([]);
  });

  test("two outbound user xrefs are a star", () => {
    const groups = realVerseGroups([note(DEMO_HUB, [xref("1pe.5.6"), xref("est.4.14")])]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.trigger).toBe("star");
    expect(groups[0]?.outboundCount).toBe(2);
    expect(groups[0]?.missingCount).toBe(1);
    expect(groups[0]?.missingPairs[0]).toMatchObject({ from: "1pe.5.6", to: "est.4.14" });
  });

  test("a one-way user xref counts as already linked, so the reverse is not offered", () => {
    const notes = [
      note("1pe.5.6", [xref(DEMO_HUB), xref("est.4.14")]),
      note("est.4.14", [xref(DEMO_HUB)]),
    ];
    const group = realVerseGroups(notes)[0]!;
    expect(group.missingPairs.some((pair) => pair.from === "1pe.5.6" && pair.to === "est.4.14")).toBe(false);
    expect(group.missingCount).toBe(0);
  });

  test("a scanned xref counts and a self-xref does not", () => {
    const groups = realVerseGroups([
      note("1pe.5.6", [xref(DEMO_HUB, "scan"), xref("1pe.5.6")]),
      note("jhn.9.3", [xref(DEMO_HUB)]),
    ]);
    expect(groups[0]?.inboundCount).toBe(2);
  });

  test("saved title and description attach to the hub, and named webs sort first", () => {
    const notes = [
      note("1pe.5.6", [xref(DEMO_HUB)]),
      note("est.4.14", [xref(DEMO_HUB)]),
      note("jhn.9.3", [xref("rom.8.28")]),
      note("rom.12.3", [xref("rom.8.28")]),
    ];
    const groups = realVerseGroups(notes, [
      { hub: "ROM.9.17", title: "Raised up", description: "For this purpose", undoPairs: [{ from: "1pe.5.6", to: "est.4.14" }] },
    ]);
    expect(groups.map((group) => group.hub)).toEqual(["rom.9.17", "rom.8.28"]);
    expect(groups[0]?.title).toBe("Raised up");
    expect(groups[0]?.description).toBe("For this purpose");
    expect(groups[0]?.undoReady).toBe(true);
    expect(groups[1]?.title).toBe("");
  });

  test("pairwise preview is capped and does not mutate the notes", () => {
    const spokes = Array.from({ length: 12 }, (_, index) => note(`jhn.1.${index + 1}`, [xref("rom.8.28")]));
    const notes = spokes.map((row) => ({ ...row, attachments: [...(row.attachments ?? [])] }));
    const before = JSON.stringify(notes);
    const group = realVerseGroups(notes)[0]!;
    expect(group.missingCount).toBeGreaterThan(PAIR_FILL_CAP);
    expect(group.missingPairs).toHaveLength(PAIR_FILL_CAP);
    expect(JSON.stringify(notes)).toBe(before);
    const planned = missingPairwise(
      group.members.map((member) => member.slug),
      userEdges(notes),
    );
    expect(planned.total).toBe(group.missingCount);
  });

  test("manual xref helper refuses a duplicate and undo leaves backlinks", () => {
    const list = [xref(DEMO_HUB, "backlink"), xref("est.4.14")];
    const added = withManualXref(list, "est.4.14", "att_newlink01");
    expect(added.added).toBe(false);
    const fresh = withManualXref(list, "jhn.9.3", "att_newlink01");
    expect(fresh.added).toBe(true);
    expect(fresh.list.some((row) => row.kind === "xref" && row.slug === "jhn.9.3" && row.source === "manual")).toBe(true);
    const removed = withoutUserXref(list, "est.4.14");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.source).toBe("backlink");
  });

  test("title is one line and description keeps newlines inside the cap", () => {
    expect(cleanGroupTitle(`  hello \n web  ${"x".repeat(200)}`)).toBe(`hello web ${"x".repeat(110)}`);
    expect(cleanGroupTitle("x".repeat(130)).length).toBe(120);
    const description = cleanGroupDescription(`  line\r\nnext  ${"y".repeat(3_000)}`);
    expect(description.startsWith("line\nnext")).toBe(true);
    expect(description.length).toBe(2_000);
  });
});

describe("preview worker publish", () => {
  test("deploys a separate worker and leaves the production name in config", () => {
    const script = readFileSync(new URL("../scripts/preview-worker.sh", import.meta.url), "utf8");
    const workflow = readFileSync(new URL("../.github/workflows/preview-worker.yml", import.meta.url), "utf8");
    const config = readFileSync(new URL("../cloudflare.config.ts", import.meta.url), "utf8");
    expect(script).toContain('preview_name="margin-bible-verse-groups"');
    expect(script).toContain("production worker is serving this preview build");
    expect(script).toContain('id="verse-groups-btn"');
    expect(script).not.toContain("migrations apply");
    expect(workflow).toContain("sh scripts/preview-worker.sh");
    expect(workflow).not.toContain("refs/heads/main");
    expect(config).toContain('name: "margin-bible"');
    expect(config).not.toContain("margin-bible-verse-groups");
  });
});

describe("verse groups inbox", () => {
  test("empty inbox puts Verse groups beside Bookmarks and shows the seed mesh", () => {
    const html = renderNotesIndex([], "jhn.1");
    const rowStart = html.indexOf('class="inbox-tool-row"');
    const row = html.slice(rowStart, html.indexOf('id="verse-groups-panel"'));
    expect(row).toContain(">Bookmarks</span>");
    expect(row).toContain('id="verse-groups-btn"');
    expect(row.indexOf(">Bookmarks</span>")).toBeLessThan(row.indexOf('id="verse-groups-btn"'));
    expect(row).toContain(">Verse groups</span>");
    expect(html).toContain('aria-controls="verse-groups-panel"');
    expect(html).toContain('data-hub="rom.9.17"');
    expect(html).toContain("1 Peter 5:6");
    expect(html).toContain("Esther 4:14");
    expect(html).toContain("John 9:3");
    expect(html).toContain("Romans 12:3");
    expect(html).toContain("Name this web");
    expect(html).toContain("Add the cross-links in this web");
    expect(html).toContain("Nothing is added until you confirm");
    expect(html).toContain('class="verse-group-preview" hidden');
    expect(html).not.toMatch(/>Open</);
    const css = page("t", "<p>x</p>");
    expect(css).toContain(".inbox-tool-row");
    expect(css).toContain(".verse-groups-btn");
    nodeCheck(verseGroupsScript());
  });

  test("a real fan-in card escapes the title and is not marked sample", () => {
    const html = verseGroupCardHtml({
      hub: "rom.9.17",
      hubLabel: "Romans 9:17",
      title: `<script>alert("x")</script>`,
      description: "purpose",
      members: [
        { slug: "rom.9.17", label: "Romans 9:17", role: "hub" },
        { slug: "1pe.5.6", label: "1 Peter 5:6", role: "member" },
      ],
      trigger: "fan-in",
      inboundCount: 2,
      outboundCount: 0,
      why: "2 notes point at Romans 9:17.",
      sample: false,
      seed: true,
      missingPairs: [],
      missingCount: 0,
      undoReady: false,
    });
    expect(html).toContain("data-sample=\"0\"");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain(">Save</button>");
    expect(html).toContain("Cross-links already connect this web.");
  });
});
