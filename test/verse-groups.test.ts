import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
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
  verseMemberFromInput,
  missingPairwise,
  realVerseGroups,
  userEdges,
  verseGroupsFromNotes,
  withManualXref,
  withoutUserXref,
  type GroupNote,
} from "../src/verse-groups";
import { closestJevTopic, DEMO_VERSE_TEXTS, JEV_TOPICS } from "../src/jev-topics";
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

  test("an empty library has no verse groups", () => {
    expect(verseGroupsFromNotes([])).toEqual([]);
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

  test("a verse chip accepts a passage and refuses a url", () => {
    expect(verseMemberFromInput("John 9:3")).toEqual({ ok: true, slug: "jhn.9.3", label: "John 9:3" });
    expect(verseMemberFromInput("https://example.com/note")).toEqual({ ok: false, error: "Need a passage." });
    expect(verseMemberFromInput("")).toEqual({ ok: false, error: "Need a passage." });
  });
});

describe("preview worker publish", () => {
  test("deploys a separate worker and leaves the production name in config", () => {
    const script = readFileSync(new URL("../scripts/preview-worker.sh", import.meta.url), "utf8");
    const workflow = readFileSync(new URL("../.github/workflows/preview-worker.yml", import.meta.url), "utf8");
    const config = readFileSync(new URL("../cloudflare.config.ts", import.meta.url), "utf8");
    expect(script).toContain('preview_name="margin-bible-verse-groups"');
    expect(script).toContain("production worker is serving this preview build");
    expect(script).toContain('id="verse-groups-view"');
    expect(script).toContain("No verse groups yet");
    expect(script).toContain("sample save is still in the preview");
    expect(script).not.toContain("migrations apply");
    expect(workflow).toContain("sh scripts/preview-worker.sh");
    expect(workflow).not.toContain("refs/heads/main");
    expect(config).toContain('name: "margin-bible"');
    expect(config).not.toContain("margin-bible-verse-groups");
    expect(script).not.toContain("railway");
    expect(workflow).not.toContain("railway");
    expect(existsSync(new URL("../Dockerfile", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../railway.toml", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/preview-server.ts", import.meta.url))).toBe(false);
  });
});

describe("local topic guess", () => {
  test("keyword scoring on the seed passages lands on Providence, under God", () => {
    const match = closestJevTopic(DEMO_VERSE_TEXTS);
    expect(match?.parent).toBe("God");
    expect(match?.parentId).toBe("god");
    expect(match?.child).toBe("Providence");
    expect(match && match.passages >= 3).toBe(true);
  });

  test("an empty passage list has no topic", () => {
    expect(closestJevTopic(["", "  "])).toBeNull();
  });

  test("parents are the first step and children stay under a parent", () => {
    const labels = JEV_TOPICS.map((parent) => parent.label);
    expect(labels).toEqual(["God", "Character", "Life"]);
    const god = JEV_TOPICS.find((parent) => parent.id === "god");
    expect(god?.children.map((child) => child.label)).toContain("Providence");
    expect(god?.children.map((child) => child.label)).not.toContain("Humility");
  });
});

describe("verse groups inbox", () => {
  test("empty inbox uses the Bookmarks chrome and an empty library state", () => {
    const html = renderNotesIndex([], "jhn.1");
    expect(html.match(/class="bookmarks-view"/g)).toHaveLength(2);
    expect(html.indexOf('id="bookmarks-view"')).toBeLessThan(html.indexOf('id="verse-groups-view"'));
    expect(html).toContain(">Bookmarks</span>");
    expect(html).toContain(">Verse groups</span>");
    expect(html).toContain("No verse groups yet — link 2+ notes to a hub");
    expect(html).not.toContain("verse-groups-btn");
    expect(html).not.toContain("inbox-tool-row");
    expect(html).not.toContain("Save sample");
    expect(html).not.toContain('data-hub="rom.9.17"');
    expect(html).toContain("John 3:16");
    const css = page("t", "<p>x</p>");
    expect(css).toContain(".bookmarks-view");
    expect(css).not.toContain(".verse-groups-btn");
    expect(css).not.toContain(".inbox-tool-row");
    expect(css).toContain(".verse-group .att-chip");
    expect(css).toContain(".verse-group .att-remove");
    const coarse = css.slice(css.indexOf("@media (hover: none), (pointer: coarse)"));
    const verseChip = coarse.slice(coarse.indexOf(".verse-group .att-chip"));
    expect(verseChip).toContain("font-size: 1rem");
    expect(verseChip).toContain("position: static");
    expect(verseChip).toContain("min-width: var(--tap)");
    nodeCheck(verseGroupsScript());
  });

  test("a library web collapses like a bookmark and keeps the guess out of the title", () => {
    const html = renderNotesIndex([], "jhn.1", {
      verseGroups: [
        {
          hub: "rom.9.17",
          hubLabel: "Romans 9:17",
          title: "",
          description: "",
          members: [
            { slug: "rom.9.17", label: "Romans 9:17", role: "hub" },
            { slug: "1pe.5.6", label: "1 Peter 5:6", role: "member" },
            { slug: "est.4.14", label: "Esther 4:14", role: "member" },
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
          suggestedTitle: "Providence",
          topicParent: "god",
        },
      ],
    });
    expect(html).toContain('class="verse-group"');
    expect(html).toContain('<summary class="note-row">');
    expect(html).toContain(">Romans 9:17</span>");
    expect(html).toContain("local topic guess · Providence");
    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="Providence"');
    expect(html).toContain("local topic guess");
    expect(html).not.toContain('value="Providence"');
    expect(html).toContain('class="verse-group-description"');
    expect(html).not.toContain('class="verse-group-description" open');
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain("Save sample");
    const panel = html.slice(html.indexOf('id="verse-groups-panel"'));
    const parents = panel.slice(panel.indexOf("verse-group-topic-parents"), panel.indexOf("verse-group-topic-children"));
    expect(parents).toContain(">God</button>");
    expect(parents).toContain(">Character</button>");
    expect(parents).toContain(">Life</button>");
    expect(parents).not.toContain("Providence");
    expect(html).toContain('data-parent="god" hidden');
    expect(html).toContain('data-vg-topic-child="Providence"');
    expect(html).toContain('class="att-chip wiki"');
    expect(html).toContain('data-vg-attach');
    expect(html).toContain("1 Peter 5:6");
    expect(html).toContain("Esther 4:14");
    expect(html).not.toContain('<details class="verse-group" data-hub="rom.9.17" data-sample="0" data-seed="1" open');
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
    expect(html).toContain('class="verse-group-description" open');
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain("Save sample");
    expect(html).toContain('<summary class="note-row">');
    expect(html).toContain('value="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"');
    expect(html).not.toContain("local topic guess");
    expect(html).toContain('class="att-chip wiki"');
    expect(html).toContain("1 Peter 5:6");
    expect(html).not.toContain("verse-group-preview");
    expect(html).not.toContain("border-left");
  });
});
