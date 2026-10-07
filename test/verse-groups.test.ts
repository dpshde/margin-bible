import { Database } from "bun:sqlite";
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
  titleStillFromJev,
  groupAttachFromInput,
  verseMemberFromInput,
  withExternalRef,
  withoutExternalRef,
  missingPairwise,
  realVerseGroups,
  userEdges,
  verseGroupsFromNotes,
  withManualXref,
  withoutUserXref,
  type GroupNote,
} from "../src/verse-groups";
import { closestJevTopic, DEMO_VERSE_TEXTS, JEV_TOPICS } from "../src/jev-topics";
import { previewSeedNeeded, previewSeedNotes } from "../src/preview-seed";
import { notesInboxScript } from "../src/inbox-ui";
import { listNotes } from "../src/library";
import { handleVerseGroupAction, loadVerseGroups } from "../src/verse-groups-store";
import { suggestVerseGroupTopic } from "../src/verse-topic";
import {
  topicsQueryOpens,
  verseGroupCardHtml,
  verseGroupsScript,
  verseGroupsViewHtml,
} from "../src/verse-groups-ui";

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
    expect(groups[0]?.autoTitled).toBe(true);
    expect(groups[1]?.autoTitled).toBe(false);
    expect(groups[0]?.description).toBe("For this purpose");
    expect(groups[0]?.undoReady).toBe(true);
    expect(groups[1]?.title).toBe("");
  });

  test("a stored star moves that member to the front and an empty star keeps natural order", () => {
    const notes = [note(DEMO_HUB, [xref("1pe.5.6"), xref("est.4.14")])];
    const natural = realVerseGroups(notes)[0]!;
    expect(natural.star).toBe("");
    expect(natural.members.map((member) => member.slug)).toEqual([DEMO_HUB, "1pe.5.6", "est.4.14"]);
    const starred = realVerseGroups(notes, [
      { hub: DEMO_HUB, title: "", description: "", undoPairs: [], star: "est.4.14" },
    ]);
    expect(starred[0]?.hub).toBe(DEMO_HUB);
    expect(starred[0]?.star).toBe("est.4.14");
    expect(starred[0]?.members.map((member) => member.slug)).toEqual(["est.4.14", DEMO_HUB, "1pe.5.6"]);
    expect(starred[0]?.members.find((member) => member.slug === "est.4.14")?.order).toBe(2);
    const fallback = realVerseGroups(notes, [
      { hub: DEMO_HUB, title: "", description: "", undoPairs: [], star: "jhn.3.16" },
    ]);
    expect(fallback[0]?.star).toBe("");
    expect(fallback[0]?.members.map((member) => member.slug)).toEqual(natural.members.map((member) => member.slug));
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
    expect(titleStillFromJev("The Word", "The Word")).toBe(true);
    expect(titleStillFromJev("  The Word  ", "The Word")).toBe(true);
    expect(titleStillFromJev("My title", "The Word")).toBe(false);
    expect(titleStillFromJev("", "The Word")).toBe(false);
    expect(titleStillFromJev("The Word", "")).toBe(false);
    const description = cleanGroupDescription(`  line\r\nnext  ${"y".repeat(3_000)}`);
    expect(description.startsWith("line\nnext")).toBe(true);
    expect(description.length).toBe(2_000);
  });

  test("a verse chip accepts a passage and refuses a url", () => {
    expect(verseMemberFromInput("John 9:3")).toEqual({ ok: true, slug: "jhn.9.3", label: "John 9:3" });
    expect(verseMemberFromInput("https://example.com/note")).toEqual({ ok: false, error: "Need a passage." });
    expect(verseMemberFromInput("")).toEqual({ ok: false, error: "Need a passage." });
  });

  test("a url is an external ref and a passage is still a member", () => {
    expect(groupAttachFromInput("John 9:3")).toEqual({ ok: true, kind: "xref", slug: "jhn.9.3", label: "John 9:3" });
    expect(groupAttachFromInput("https://route.bible/jhn.3.16")).toMatchObject({
      ok: true,
      kind: "url",
      url: "https://route.bible/jhn.3.16",
      title: "route.bible",
    });
    expect(groupAttachFromInput("notaurl")).toEqual({ ok: false, error: "Need a passage or an http(s) link." });
    const added = withExternalRef([], { id: "att_abcd1234", url: "https://example.com/note", title: "Example" });
    expect(added.added).toMatchObject({ id: "att_abcd1234", url: "https://example.com/note", title: "Example" });
    expect(withExternalRef(added.list, added.added!).added).toBeNull();
    expect(withExternalRef(added.list, { id: "nope", url: "https://other.test", title: "Other" }).added).toBeNull();
    const removed = withoutExternalRef(added.list, "https://example.com/note");
    expect(removed.removed).toBe(true);
    expect(removed.list).toEqual([]);
    expect(withoutExternalRef(added.list, "John 9:3").removed).toBe(false);
  });
});

describe("preview worker publish", () => {
  test("deploys a separate worker and leaves the production name in config", () => {
    const script = readFileSync(new URL("../scripts/preview-worker.sh", import.meta.url), "utf8");
    const workflow = readFileSync(new URL("../.github/workflows/preview-worker.yml", import.meta.url), "utf8");
    const config = readFileSync(new URL("../cloudflare.config.ts", import.meta.url), "utf8");
    expect(script).toContain("verse-count-pill");
    expect(script).toContain('id="verse-groups-view" open');
    expect(script).toContain(">Topics</span>");
    expect(script).toContain('preview_name="margin-bible-verse-groups"');
    expect(script).toContain("production worker is serving this preview build");
    expect(script).toContain('id="verse-groups-view"');
    expect(script).toContain("No topics yet. Link 2+ notes to a hub");
    expect(script).toContain("sample save is still in the preview");
    expect(script).not.toContain("migrations apply");
    expect(workflow).toContain("sh scripts/preview-worker.sh");
    expect(workflow).not.toContain("refs/heads/main");
    expect(config).toContain('name: "margin-bible"');
    expect(config).not.toContain("margin-bible-verse-groups");
    expect(config).not.toContain("PREVIEW_SEED");
    expect(script).toContain('PREVIEW_SEED: bindings.text("1")');
    expect(script).not.toContain("railway");
    expect(workflow).not.toContain("railway");
    expect(existsSync(new URL("../Dockerfile", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../railway.toml", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/preview-server.ts", import.meta.url))).toBe(false);
  });
});

describe("preview guest seed", () => {
  test("seed webs cover short topics and groups large enough to show a count", () => {
    const notes = previewSeedNotes();
    expect(notes).toHaveLength(10);
    const groups = realVerseGroups(notes);
    expect(groups.map((group) => group.hub).sort()).toEqual([
      "eph.2.8",
      "est.4.14",
      "heb.12.6",
      "jhn.1.1",
      "mat.11.28",
      "mat.5.3",
      "php.4.11",
      "psa.23.1",
      "rom.5.3",
      "rom.8.28",
    ]);
    expect(groups.every((group) => group.sample === false)).toBe(true);
    expect(groups.find((group) => group.hub === "jhn.1.1")?.members).toHaveLength(3);
    expect(groups.find((group) => group.hub === "rom.8.28")?.members.length).toBeGreaterThan(3);
    expect(groups.find((group) => group.hub === "eph.2.8")?.members.length).toBeGreaterThan(3);
    expect(groups.find((group) => group.hub === "rom.5.3")?.members.length).toBeGreaterThan(3);
    expect(notes.every((note) => (note.attachments?.length ?? 0) >= 2)).toBe(true);
    expect(groups.every((group) => group.star === "")).toBe(true);
    expect(groups.every((group) => group.members[0]?.slug === group.hub)).toBe(true);
    expect(previewSeedNeeded(notes)).toBe(false);
    expect(previewSeedNeeded([])).toBe(true);
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
    expect(html).toContain(">Topics</span>");
    expect(html).toContain("No topics yet. Link 2+ notes to a hub");
    expect(html).not.toContain("verse-groups-btn");
    expect(html).not.toContain("inbox-tool-row");
    expect(html).not.toContain("Save sample");
    expect(html).not.toContain('data-hub="rom.9.17"');
    expect(html).toContain("John 3:16");
    expect(html).toContain("A link stays on this topic as a chip. A passage joins the verses.");
    const css = page("t", "<p>x</p>");
    expect(css).toContain(".bookmarks-view");
    expect(css).not.toContain(".verse-groups-btn");
    expect(css).not.toContain(".inbox-tool-row");
    expect(css).toContain(".verse-group .att-chip");
    expect(css).toContain(".verse-group .att-remove");
    expect(css).not.toContain('.verse-group-form input[name="title"]');
    expect(css).not.toContain(".verse-group-title-field");
    expect(css).toContain('.verse-group > summary .note-row-title[contenteditable="true"] {\n      cursor: text;');
    expect(css).toContain('.verse-group > summary .note-row-title[contenteditable="true"]:empty::before {\n      content: "Title";');
    expect(css).toContain(".verse-group-fields {\n      display: flex;\n      flex-direction: column;");
    expect(css).toContain(".verse-group[open] > summary.note-row {\n      background: var(--ink);\n      color: var(--paper);\n    }");
    expect(css).toContain(".verse-group-title-actions {\n      display: inline-flex;");
    expect(css).toContain(".verse-group > summary .tray-attach {");
    expect(css).not.toContain("padding: .42rem .7rem;");
    expect(css).toContain(".verse-group.is-drop");
    expect(css).toContain(".verse-group-drag-ghost");
    expect(css).toContain(".verse-group.is-collapsed-hover:not([open]) > summary.note-row:hover");
    expect(css).toContain(".verse-group[open] > summary.note-row:focus");
    expect(css).toContain('.verse-group .verse-star[aria-pressed="true"] { color: #b0893e; }');
    expect(css).toContain(".verse-group .verse-star,\n    .verse-group .att-remove {");
    const controls = css.slice(css.indexOf(".verse-group .verse-star,\n    .verse-group .att-remove {"));
    expect(controls.slice(0, 900)).toContain("visibility: hidden");
    expect(controls.slice(0, 900)).toContain("width: 0;");
    expect(controls.slice(0, 900)).toContain("min-width: 0;");
    expect(controls).toContain(".verse-group .att-item:hover .verse-star");
    expect(controls).toContain(".verse-group .att-item:hover .att-remove");
    expect(controls).toContain("transition: opacity .12s ease, color .12s ease;");
    expect(controls).not.toContain("transition: width");
    expect(controls).not.toContain("linear .16s");
    expect(controls).toContain(".verse-group.is-member-quiet .att-item:hover:not(:focus-within) .verse-star:not([aria-pressed=\"true\"])");
    expect(controls).toContain('.verse-group .verse-star[aria-pressed="true"] {\n        width: 1.35rem;\n        min-width: 1.35rem;');
    expect(controls).toContain(".verse-group .att-item:hover .verse-star,\n      .verse-group .att-item:hover .att-remove");
    expect(controls).toContain("padding-right: .12rem;");
    expect(controls).toContain("@media (hover: none), (pointer: coarse)");
    expect(css).toContain(".verse-group-members {\n        flex-direction: column;");
    const phoneMembers = css.slice(css.indexOf("@media (max-width: 767px) {\n      .verse-group-verses {"));
    expect(phoneMembers.slice(0, 2200)).toContain("flex-direction: column;");
    expect(phoneMembers).toContain("min-height: var(--tap);");
    expect(phoneMembers).toContain(".verse-group .att-item > .verse-star,\n      .verse-group .att-item > a + .att-remove {\n        margin-left: auto;");
    expect(css).not.toContain("ph-sparkle");
    expect(css).not.toContain(".verse-group-topic");
    expect(css).not.toContain("verse-group-member-actions");
    expect(css).not.toContain(".att-chip.is-star");
    expect(css).toContain("outline: none;");
    expect(css).toContain("background: transparent;");
    expect(verseGroupsScript()).toContain("is-collapsed-hover");
    expect(verseGroupsScript()).toContain("set-star");
    expect(verseGroupsScript()).not.toContain("ph-sparkle");
    expect(verseGroupsScript()).not.toContain("data-vg-topic");
    expect(verseGroupsScript()).not.toContain("syncTopicLock");
    expect(verseGroupsScript()).toContain("autoTitlePass");
    expect(verseGroupsScript()).toContain("move-member");
    expect(verseGroupsScript()).toContain("function applyMemberMove");
    expect(verseGroupsScript()).toContain("function applyMemberRemove");
    expect(verseGroupsScript()).toContain("function quietMemberHover");
    expect(verseGroupsScript()).toContain("is-member-quiet");
    expect(verseGroupsScript()).toContain("function blurRemovedMember");
    expect(verseGroupsScript()).toContain("function dropCard");
    expect(verseGroupsScript()).toContain("payload.dissolved");
    expect(verseGroupsScript()).toContain("payload.sourceDissolved");
    expect(verseGroupsScript()).toContain("opts.member");
    expect(verseGroupsScript()).not.toContain("Moving…");
    expect(verseGroupsScript()).not.toContain("Removing…");
    expect(verseGroupsScript()).toContain("verse-group-drag-ghost");
    expect(verseGroupsScript()).toContain("syncTitleEdit");
    expect(verseGroupsScript()).toContain("function beginTitleEdit");
    expect(verseGroupsScript()).toContain("verse-group-title-edit");
    const syncTitle = verseGroupsScript().slice(
      verseGroupsScript().indexOf("function syncTitleEdit"),
      verseGroupsScript().indexOf("function storedTitle"),
    );
    expect(syncTitle).not.toContain('setAttribute("contenteditable", "true")');
    expect(verseGroupsScript()).toContain('getAttribute("data-title")');
    expect(verseGroupsScript()).not.toContain("input[name=title]");
    expect(verseGroupsScript()).toContain('data-auto-titled');
    expect(verseGroupsScript()).toContain("data-auto-title-started");
    expect(verseGroupsScript()).toContain("preloadMembers");
    expect(verseGroupsScript()).toContain("__marginPreloadHrefs");
    expect(notesInboxScript()).toContain("window.__marginPreloadHrefs = preloadHrefs");
    expect(notesInboxScript()).toContain('a.classList?.contains("att-chip") && a.classList?.contains("wiki")');
    const inbox = notesInboxScript();
    const preload = inbox.slice(inbox.indexOf("function preloadHrefs"));
    expect(preload).toContain('const chapterKey = documentHref("/" + slug);');
    expect(preload).toContain("prefetchChapter(chapterKey, { priority: \"low\" });");
    expect(preload).not.toContain("searchPrefetch.controller.abort");
    expect(inbox).toContain("useChapterCache: verseChip");
    expect(inbox).toContain("const chapterPromise = htmlCache.get(chapterKey);");
    nodeCheck(inbox);
    expect(verseGroupsScript()).toContain('typeof payload.star === "string"');
    expect(verseGroupsScript()).toContain("items[j] !== starred");
    expect(verseGroupsScript()).toContain("suggest-title");
    expect(css).not.toContain(".verse-group[open] > summary .note-row-title,\n    .verse-group[open] > summary .note-row-excerpt { display: none; }");
    const titleRule = css.slice(css.indexOf('.verse-group > summary .note-row-title[contenteditable="true"] {'));
    expect(titleRule.slice(0, 700)).not.toContain("paper-raised");
    expect(css).toContain("background: color-mix(in srgb, var(--ink) 8%, transparent);");
    expect(css).toContain("textarea.verse-group-description::placeholder {\n      color: var(--faint);");
    expect(css).toContain("textarea.verse-group-description {\n      display: block;\n      resize: vertical;");
    expect(css).not.toContain("textarea.verse-group-description:focus");
    expect(css).not.toContain(".verse-group-description > summary");
    expect(css).not.toContain(".verse-group-optional");
    const coarse = css.slice(css.indexOf("@media (hover: none), (pointer: coarse)"));
    const verseChip = coarse.slice(coarse.indexOf(".verse-group .att-chip"));
    expect(verseChip).toContain("font-size: .84rem");
    expect(verseChip).toContain("position: static");
    expect(verseChip).toContain("min-width: var(--tap)");
    nodeCheck(verseGroupsScript());
  });

  test("a library web collapses like a bookmark and keeps the title field empty until typed", () => {
    const html = renderNotesIndex([], "jhn.1", {
      verseGroups: [
        {
          hub: "rom.8.28",
          hubLabel: "Romans 8:28",
          star: "",
          title: "",
          description: "",
          members: [
            { slug: "rom.8.28", label: "Romans 8:28", role: "hub" },
            { slug: "rom.8.31", label: "Romans 8:31", role: "member" },
            { slug: "rom.8.38", label: "Romans 8:38", role: "member" },
          ],
          trigger: "star",
          inboundCount: 0,
          outboundCount: 2,
          why: "This note points at 2 verses.",
          sample: false,
          seed: false,
          missingPairs: [],
          missingCount: 0,
          undoReady: false,
          suggestedTitle: "Providence",
          topicParent: "god",
        },
      ],
    });
    expect(html).toContain('class="verse-group"');
    expect(html).toContain('<summary class="note-row verse-group-row">');
    expect(html).toContain(">Romans 8:28</span>");
    expect(html).toContain('class="note-row-title" data-title="" contenteditable="false"');
    expect(html).toContain('class="verse-group-title-edit"');
    expect(html).toContain('aria-label="Edit title"');
    expect(html).toContain("m229.66 58.34l-32-32a8 8 0 0 0-11.32 0l-96 96");
    expect(html.indexOf('class="note-row-title"')).toBeLessThan(html.indexOf('class="verse-group-title-edit"'));
    const cardStart = html.indexOf('<details class="verse-group"');
    const card = html.slice(cardStart, html.indexOf("</details>", cardStart));
    const summary = card.slice(card.indexOf("<summary"), card.indexOf("</summary>"));
    expect(summary).toContain('class="verse-group-title-actions"');
    expect(summary.indexOf('class="verse-group-title-edit"')).toBeLessThan(summary.indexOf("data-vg-attach"));
    expect(summary).toContain('aria-label="Attach a link or passage"');
    const verses = html.slice(html.indexOf('class="verse-group-verses"'), html.indexOf('class="verse-group-status"'));
    expect(verses).not.toContain("data-vg-attach");
    expect(verses).not.toContain("tray-attach");
    expect(html).not.toContain('name="title"');
    expect(html).not.toContain('placeholder="Title"');
    expect(html).toContain('placeholder="Description"');
    expect(html).not.toContain(">Description</summary>");
    expect(html).toContain('class="verse-group-hub">Romans 8:28</span>');
    expect(html).not.toContain("verse-group-optional");
    expect(html).not.toContain(">optional<");
    expect(html).not.toContain("local topic guess");
    expect(html).not.toContain("Providence");
    expect(html).not.toContain("data-vg-topics");
    expect(html).not.toContain("verse-group-save");
    expect(html).not.toContain(">Save</button>");
    expect(html).not.toContain("Save sample");
    expect(html).toContain('class="verse-group-description"');
    expect(html).not.toContain('class="verse-group-description" open');
    expect(html).toContain("scheduleSave");
    expect(html).toContain('class="att-chip wiki"');
    expect(html).toContain('data-vg-attach');
    expect(html).toContain("Romans 8:31");
    expect(html).toContain('data-hub="rom.8.28"');
    expect(html).toContain('data-star=""');
    expect(html).toContain('data-vg-star');
    expect(html).not.toContain("data-vg-topic");
    expect(html).not.toContain("ph-sparkle");
    expect(html).toContain('data-auto-titled="0"');
    expect(html).toContain('class="att-board verse-group-members"');
    expect(html).not.toContain("verse-group-member-actions");
    const verseCard = html.slice(html.indexOf('id="verse-groups-view"'), html.indexOf('id="vg-att-drop"'));
    expect(verseCard).not.toContain('aria-pressed="true"');
    expect(verseCard).toContain('aria-pressed="false"');
    expect(verseCard).not.toContain("att-chip wiki is-star");
    const chipAt = verseCard.indexOf('class="att-chip wiki"');
    const starAt = verseCard.indexOf('class="verse-star"');
    const removeAt = verseCard.indexOf('class="att-remove"');
    expect(chipAt).toBeGreaterThan(-1);
    expect(chipAt).toBeLessThan(starAt);
    expect(starAt).toBeLessThan(removeAt);
    expect(html.indexOf('data-att-slug="rom.8.28"')).toBeLessThan(html.indexOf('data-att-slug="rom.8.31"'));
    expect(html).not.toMatch(/<details class="verse-group"[^>]*open/);
  });

  test("a real fan-in card escapes the title and is not marked sample", () => {
    const html = verseGroupCardHtml({
      hub: "rom.9.17",
      hubLabel: "Romans 9:17",
      star: "rom.9.17",
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
      autoTitled: true,
    });
    expect(html).toContain("data-sample=\"0\"");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('class="verse-group-description"');
    expect(html).toContain(">purpose</textarea>");
    expect(html).not.toContain(">Description</summary>");
    expect(html).not.toContain("verse-group-save");
    expect(html).not.toContain(">Save</button>");
    expect(html).not.toContain("Save sample");
    expect(html).toContain('<summary class="note-row verse-group-row">');
    expect(html).toContain('data-title="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"');
    expect(html).not.toContain('name="title"');
    expect(html).not.toContain("local topic guess");
    expect(html).toContain('class="att-chip wiki"');
    expect(html).toContain("1 Peter 5:6");
    expect(html).not.toContain("verse-group-preview");
    expect(html).not.toContain("border-left");
    expect(html).not.toContain("ph-sparkle");
    expect(html).not.toContain("data-vg-topic");
    expect(html).toContain('data-auto-titled="1"');
    expect(html).not.toContain("data-topic-set");
  });

  test("a url chip sits with the verses and is not a member xref", () => {
    const html = verseGroupCardHtml({
      hub: "rom.9.17",
      hubLabel: "Romans 9:17",
      star: "",
      title: "",
      autoTitled: false,
      description: "",
      members: [
        { slug: "rom.9.17", label: "Romans 9:17", role: "hub" },
        { slug: "1pe.5.6", label: "1 Peter 5:6", role: "member" },
      ],
      externalRefs: [{ id: "att_abcd1234", url: "https://example.com/study", title: "example.com" }],
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
    expect(html).toContain('class="att-chip wiki"');
    expect(html).toContain('class="att-chip att-url"');
    expect(html).toContain('href="https://example.com/study"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('data-att-kind="url"');
    expect(html).toContain('data-att-url="https://example.com/study"');
    expect(html.indexOf('data-att-slug="1pe.5.6"')).toBeLessThan(html.indexOf('class="att-chip att-url"'));
    const urlAt = html.indexOf('class="att-chip att-url"');
    const urlItem = html.slice(html.lastIndexOf("<li", urlAt), html.indexOf("</li>", urlAt));
    expect(urlItem).not.toContain("verse-star");
    expect(urlItem).toContain("att-remove");
    expect(verseGroupsScript()).toContain("remove-external");
    expect(verseGroupsScript()).toContain('data-att-kind") === "url"');
    expect(verseGroupsScript()).toContain("function applyExternalAdd");
    expect(verseGroupsScript()).toContain("function applyExternalRemove");
    expect(verseGroupsScript()).toContain("retitle-external");
    expect(verseGroupsScript()).toContain("/api/link-title");
    const urlRemove = verseGroupsScript().slice(
      verseGroupsScript().indexOf("function removeExternal"),
      verseGroupsScript().indexOf("function attachText"),
    );
    expect(urlRemove).toContain("applyExternalRemove");
    expect(urlRemove).toContain("member: true");
    expect(urlRemove).not.toContain("location.reload");
    expect(verseGroupsScript()).toContain("if (url) removeExternal(card, url);");
    const urlAdd = verseGroupsScript().slice(
      verseGroupsScript().indexOf("function attachUrl"),
      verseGroupsScript().indexOf("function removeExternal"),
    );
    expect(urlAdd.indexOf("applyExternalAdd")).toBeGreaterThan(-1);
    expect(urlAdd.indexOf("dialog.close")).toBeGreaterThan(urlAdd.indexOf("applyExternalAdd"));
    expect(urlAdd.indexOf("member: true")).toBeGreaterThan(urlAdd.indexOf("dialog.close"));
    expect(urlAdd).not.toContain("location.reload");
  });

  test("a saved title is locked without a sparkle button", () => {
    const html = verseGroupCardHtml({
      hub: "jhn.1.1",
      hubLabel: "John 1:1",
      star: "",
      title: "The Word made flesh",
      titleFromJev: true,
      autoTitled: true,
      description: "",
      members: [
        { slug: "jhn.1.1", label: "John 1:1", role: "hub" },
        { slug: "jhn.1.14", label: "John 1:14", role: "member" },
      ],
      trigger: "star",
      inboundCount: 0,
      outboundCount: 1,
      why: "This note points at 1 verse.",
      sample: false,
      seed: false,
      missingPairs: [],
      missingCount: 0,
      undoReady: false,
    });
    expect(html).toContain('data-auto-titled="1"');
    expect(html).not.toContain("data-vg-topic");
    expect(html).not.toContain("ph-sparkle");
    expect(html).toContain('data-title="The Word made flesh"');
    expect(html).toContain(">The Word made flesh</span>");
    expect(html).not.toContain('name="title"');
    expect(html).not.toContain('class="note-row-excerpt"');
    expect(html).toContain('class="verse-count-pill" aria-label="2 verses">2</span>');
    const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(summary).not.toContain("verse-group-mark");
    expect(summary).not.toContain("verse-group-peek");
    expect(summary).not.toContain("verse-peek-chip");
    expect(summary).toContain(">The Word made flesh</span>");
    expect(html).toContain(">John 1:14</a>");
  });
});

describe("topic rows", () => {
  test("topics, set, and folder queries open the panel", () => {
    expect(topicsQueryOpens("topics")).toBe(true);
    expect(topicsQueryOpens("set")).toBe(true);
    expect(topicsQueryOpens("folder")).toBe(true);
    expect(topicsQueryOpens(null)).toBe(false);
    expect(topicsQueryOpens("")).toBe(false);
    expect(topicsQueryOpens("note")).toBe(false);
  });

  test("a collapsed row is the title and the count, and the editor keeps every chip", () => {
    const html = verseGroupCardHtml({
      hub: "eph.2.8",
      hubLabel: "Ephesians 2:8",
      star: "",
      title: "By grace",
      autoTitled: true,
      description: "Grace, not a wage.",
      members: [
        { slug: "eph.2.8", label: "Ephesians 2:8", role: "hub" },
        { slug: "eph.2.9", label: "Ephesians 2:9", role: "member" },
        { slug: "rom.3.23", label: "Romans 3:23", role: "member" },
        { slug: "rom.6.23", label: "Romans 6:23", role: "member" },
        { slug: "tit.3.5", label: "Titus 3:5", role: "member" },
      ],
      trigger: "star",
      inboundCount: 0,
      outboundCount: 4,
      why: "This note points at 4 verses.",
      sample: false,
      seed: false,
      missingPairs: [],
      missingCount: 0,
      undoReady: false,
    });
    const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(summary).not.toContain("verse-group-mark");
    expect(summary).not.toContain("verse-group-peek");
    expect(summary).not.toContain('class="note-row-excerpt"');
    expect(summary).toContain('aria-label="5 verses">5</span>');
    expect(summary).toContain(">By grace</span>");
    expect(summary).not.toContain("verse-peek-chip");
    expect(summary).toContain('class="verse-group-hub">Ephesians 2:8</span>');
    expect(summary).toContain('class="verse-group-title-edit"');
    expect(summary).toContain("data-vg-attach");
    expect(html).toContain(">Romans 6:23</a>");
    expect(html).toContain('placeholder="Description"');
    expect(html).toContain(">Grace, not a wage.</textarea>");
  });

  test("the topics section opens from the query and hides the pencil until the row is open", () => {
    const group = {
      hub: "psa.23.1",
      hubLabel: "Psalm 23:1",
      star: "",
      title: "The shepherd",
      autoTitled: true,
      description: "",
      members: [
        { slug: "psa.23.1", label: "Psalm 23:1", role: "hub" as const },
        { slug: "psa.23.4", label: "Psalm 23:4", role: "member" as const },
      ],
      trigger: "star" as const,
      inboundCount: 0,
      outboundCount: 1,
      why: "This note points at 1 verse.",
      sample: false,
      seed: false,
      missingPairs: [],
      missingCount: 0,
      undoReady: false,
    };
    const html = verseGroupsViewHtml([group], { open: true });
    expect(html).toContain('id="verse-groups-view" open');
    expect(html).toContain(">Topics</span>");
    expect(html).not.toContain("Set rows");
    expect(html).not.toContain("Folder list");
    expect(html).not.toContain("verse-group-peek");
    expect(html).toContain('aria-label="2 verses">2</span>');
    const css = page("t", "<p>x</p>");
    expect(css).toContain(".verse-group:not([open]) > summary .verse-group-title-actions { display: none; }");
    expect(css).toContain(".verse-count-pill {");
    expect(css).toContain(".verse-group > summary.verse-group-row {");
    expect(css).toContain("min-height: 3.6rem;");
    const rowRule = css.indexOf(".verse-group > summary.verse-group-row {");
    const phoneOnly = css.indexOf("@media (max-width: 767px)", rowRule);
    expect(rowRule).toBeGreaterThan(-1);
    expect(phoneOnly).toBeGreaterThan(rowRule);
    expect(verseGroupsScript()).toContain("function syncPeek");
    expect(verseGroupsScript()).toContain('location.hash === "#groups"');
    expect(verseGroupsScript()).toContain('topicsQuery === "topics"');
    expect(notesInboxScript()).toContain('groups: "Topics"');
  });
});

function memoryD1(sqlite: Database): D1Database {
  const statement = (sql: string, args: unknown[]) => ({
    sql,
    bind(...next: unknown[]) {
      return statement(sql, next);
    },
    async run() {
      if (args.length) sqlite.run(sql, args as never[]);
      else sqlite.run(sql);
      return { success: true, results: [] as unknown[] };
    },
    async all<T>() {
      const query = sqlite.query(sql);
      const results = args.length ? query.all(...(args as never[])) : query.all();
      return { results: results as T[], success: true };
    },
    async first<T>() {
      const query = sqlite.query(sql);
      const row = args.length ? query.get(...(args as never[])) : query.get();
      return (row as T | null) ?? null;
    },
  });
  return {
    prepare(sql: string) {
      return statement(sql, []);
    },
    async batch(
      statements: Array<{ sql?: string; all: () => Promise<{ results: unknown[]; success: boolean }>; run: () => Promise<unknown> }>,
    ) {
      const out = [];
      for (const stmt of statements) {
        if (/^\s*select/i.test(stmt.sql ?? "")) out.push(await stmt.all());
        else out.push(await stmt.run());
      }
      return out;
    },
  } as unknown as D1Database;
}

function starLibrary(): D1Database {
  const sqlite = new Database(":memory:");
  sqlite.run(`CREATE TABLE notes (
    library_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    osis TEXT NOT NULL,
    kind TEXT NOT NULL,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER,
    verse_end INTEGER,
    blocks TEXT NOT NULL,
    bookmarked INTEGER NOT NULL DEFAULT 0,
    attachments TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (library_id, slug)
  )`);
  sqlite.run(
    `INSERT INTO notes (library_id, slug, osis, kind, book, chapter, verse_start, verse_end, blocks, bookmarked, attachments, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "lib",
      "jhn.1.1",
      "John.1.1",
      "verse",
      "jhn",
      1,
      1,
      1,
      "[]",
      0,
      JSON.stringify([
        { id: "att_abcd1234", kind: "xref", slug: "jhn.1.14", title: "John 1:14", source: "manual" },
        { id: "att_abcd1235", kind: "xref", slug: "jhn.1.3", title: "John 1:3", source: "manual" },
      ]),
      "2026-10-06T00:00:00.000Z",
      "2026-10-06T00:00:00.000Z",
    ],
  );
  return memoryD1(sqlite);
}

function webLibrary(): D1Database {
  const sqlite = new Database(":memory:");
  sqlite.run(`CREATE TABLE notes (
    library_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    osis TEXT NOT NULL,
    kind TEXT NOT NULL,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER,
    verse_end INTEGER,
    blocks TEXT NOT NULL,
    bookmarked INTEGER NOT NULL DEFAULT 0,
    attachments TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (library_id, slug)
  )`);
  const stamp = "2026-10-06T00:00:00.000Z";
  const insert = (slug: string, osis: string, book: string, chapter: number, verse: number, attachments: unknown[]) => {
    sqlite.run(
      `INSERT INTO notes (library_id, slug, osis, kind, book, chapter, verse_start, verse_end, blocks, bookmarked, attachments, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["lib", slug, osis, "verse", book, chapter, verse, verse, "[]", 0, JSON.stringify(attachments), stamp, stamp],
    );
  };
  insert("jhn.1.1", "John.1.1", "jhn", 1, 1, [
    { id: "att_abcd1234", kind: "xref", slug: "jhn.1.14", title: "John 1:14", source: "manual" },
    { id: "att_abcd1235", kind: "xref", slug: "jhn.1.3", title: "John 1:3", source: "manual" },
    { id: "att_abcd1236", kind: "xref", slug: "jhn.1.4", title: "John 1:4", source: "manual" },
  ]);
  insert("rom.8.28", "Romans.8.28", "rom", 8, 28, [
    { id: "att_abcd2231", kind: "xref", slug: "rom.8.31", title: "Romans 8:31", source: "manual" },
    { id: "att_abcd2238", kind: "xref", slug: "rom.8.38", title: "Romans 8:38", source: "manual" },
  ]);
  return memoryD1(sqlite);
}

const johnAssets = {
  fetch: async () =>
    new Response(
      JSON.stringify({
        verses: [
          { v: 1, text: "In the beginning was the Word." },
          { v: 3, text: "Through him all things were made." },
          { v: 14, text: "The Word became flesh." },
        ],
      }),
      { status: 200 },
    ),
};

describe("automatic verse group titles", () => {
  test("an existing title is flagged and is not sent to Jev", async () => {
    const db = starLibrary();
    const saved = await handleVerseGroupAction(db, "lib", {
      action: "save",
      hub: "jhn.1.1",
      title: "The Word made flesh",
      description: "notes",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.group.autoTitled).toBe(true);
    await db.prepare("UPDATE verse_groups SET auto_titled = 0 WHERE library_id = ? AND hub_slug = ?").bind("lib", "jhn.1.1").run();
    const notes = [note("jhn.1.1", [xref("jhn.1.14"), xref("jhn.1.3")])];
    const named = await loadVerseGroups(db, "lib", notes);
    expect(named[0]?.title).toBe("The Word made flesh");
    expect(named[0]?.autoTitled).toBe(true);

    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ answers: { topic: { choice: "In the beginning" } } }), { status: 200 });
    }) as typeof fetch;
    const held = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(held.skipped).toBe("already");
    expect(held.topic).toBe("The Word made flesh");
    expect(calls).toBe(0);
  });

  test("the first pass names an empty group once, and a later edit does not re-arm it", async () => {
    const db = starLibrary();
    let calls = 0;
    let sent = "";
    const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
      calls += 1;
      sent = String(init?.body ?? "");
      return new Response(JSON.stringify({ answers: { topic: { choice: "The Word made flesh" } } }), { status: 200 });
    }) as typeof fetch;
    const named = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(named.ok).toBe(true);
    if (!named.ok) return;
    expect(named.topic).toBe("The Word made flesh");
    expect(named.group.autoTitled).toBe(true);
    expect(named.group.titleFromJev).toBe(true);
    expect(named.skipped).toBeUndefined();
    expect(calls).toBe(1);
    expect(sent).toContain("Prefer a specific pastoral title");
    expect(sent).toContain("The Word made flesh");

    const again = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      postedTitle: "",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.skipped).toBe("already");
    expect(calls).toBe(1);

    const edited = await handleVerseGroupAction(db, "lib", {
      action: "save",
      hub: "jhn.1.1",
      title: "My title",
      description: "notes",
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.group.title).toBe("My title");
    expect(edited.group.autoTitled).toBe(true);
    expect(edited.group.titleFromJev).toBe(false);

    const cleared = await handleVerseGroupAction(db, "lib", {
      action: "save",
      hub: "jhn.1.1",
      title: "",
      description: "notes",
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.group.title).toBe("");
    expect(cleared.group.autoTitled).toBe(true);

    const added = await handleVerseGroupAction(db, "lib", {
      action: "add-member",
      hub: "jhn.1.1",
      text: "John 1:4",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.group.autoTitled).toBe(true);

    const removed = await handleVerseGroupAction(db, "lib", {
      action: "remove-member",
      hub: "jhn.1.1",
      slug: "jhn.1.4",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.group.autoTitled).toBe(true);

    const afterEdit = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      postedTitle: "Something else",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(afterEdit.ok).toBe(true);
    if (!afterEdit.ok) return;
    expect(afterEdit.skipped).toBe("already");
    expect(afterEdit.topic).toBe("");
    expect(calls).toBe(1);
  });

  test("a title already in the field is kept and Jev is not called", async () => {
    const db = starLibrary();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ answers: { topic: { choice: "In the beginning" } } }), { status: 200 });
    }) as typeof fetch;
    const claimed = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      postedTitle: "My title",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.topic).toBe("My title");
    expect(claimed.group.autoTitled).toBe(true);
    expect(claimed.group.titleFromJev).toBe(false);
    expect(calls).toBe(0);
  });

  test("a missing API key leaves the placeholder and does not lock the group", async () => {
    const db = starLibrary();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("no", { status: 500 });
    }) as typeof fetch;
    const skipped = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      apiKey: "",
      fetchImpl,
    });
    expect(skipped).toEqual({
      ok: true,
      topic: "",
      skipped: "no-key",
      group: expect.objectContaining({ title: "", autoTitled: false }),
    });
    expect(calls).toBe(0);
    const loaded = await loadVerseGroups(db, "lib", [note("jhn.1.1", [xref("jhn.1.14"), xref("jhn.1.3")])]);
    expect(loaded[0]?.title).toBe("");
    expect(loaded[0]?.autoTitled).toBe(false);
  });

  test("Jev answering None locks the group and leaves the placeholder", async () => {
    const db = starLibrary();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ answers: { topic: { choice: "None" } } }), { status: 200 });
    }) as typeof fetch;
    const none = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(none.ok).toBe(true);
    if (!none.ok) return;
    expect(none.skipped).toBe("no-topic");
    expect(none.topic).toBe("");
    expect(none.group.autoTitled).toBe(true);
    expect(calls).toBe(1);
    const repeat = await suggestVerseGroupTopic({
      db,
      assets: johnAssets,
      libraryId: "lib",
      hub: "jhn.1.1",
      apiKey: "test-key",
      fetchImpl,
    });
    expect(repeat.ok).toBe(true);
    if (!repeat.ok) return;
    expect(repeat.skipped).toBe("already");
    expect(calls).toBe(1);
  });

  test("a url attaches as an external ref and a passage still adds an xref member", async () => {
    const db = starLibrary();
    const linked = await handleVerseGroupAction(db, "lib", {
      action: "add-member",
      hub: "jhn.1.1",
      text: "https://example.com/study",
    });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.statusText).toBe("Attached example.com.");
    expect(linked.group.externalRefs?.map((ref) => ref.url)).toEqual(["https://example.com/study"]);
    expect(linked.group.members.some((member) => member.slug === "https://example.com/study")).toBe(false);
    const notes = await loadVerseGroups(db, "lib", [note("jhn.1.1", [xref("jhn.1.14"), xref("jhn.1.3")])]);
    expect(notes[0]?.externalRefs?.map((ref) => ref.title)).toEqual(["example.com"]);

    const again = await handleVerseGroupAction(db, "lib", {
      action: "add-member",
      hub: "jhn.1.1",
      text: "https://example.com/study",
    });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toBe("Already attached.");

    const passage = await handleVerseGroupAction(db, "lib", {
      action: "add-member",
      hub: "jhn.1.1",
      text: "John 1:5",
    });
    expect(passage.ok).toBe(true);
    if (!passage.ok) return;
    expect(passage.group.members.some((member) => member.slug === "jhn.1.5")).toBe(true);
    expect(passage.group.externalRefs).toHaveLength(1);

    const removed = await handleVerseGroupAction(db, "lib", {
      action: "remove-external",
      hub: "jhn.1.1",
      url: "https://example.com/study",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.group.externalRefs).toEqual([]);
    expect(removed.group.members.some((member) => member.slug === "jhn.1.5")).toBe(true);

    const missing = await handleVerseGroupAction(db, "lib", {
      action: "remove-external",
      hub: "jhn.1.1",
      url: "https://example.com/study",
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toBe("That link is not in this group.");

    const againLinked = await handleVerseGroupAction(db, "lib", {
      action: "add-member",
      hub: "jhn.1.1",
      text: "https://example.com/study",
    });
    expect(againLinked.ok).toBe(true);
    const titled = await handleVerseGroupAction(db, "lib", {
      action: "retitle-external",
      hub: "jhn.1.1",
      url: "https://example.com/study",
      title: "Grace Abounding",
    });
    expect(titled.ok).toBe(true);
    if (!titled.ok) return;
    expect(titled.group.externalRefs?.map((ref) => ref.title)).toEqual(["Grace Abounding"]);
    const kept = await loadVerseGroups(db, "lib", [note("jhn.1.1", [xref("jhn.1.14"), xref("jhn.1.3")])]);
    expect(kept[0]?.externalRefs?.map((ref) => ref.title)).toEqual(["Grace Abounding"]);
  });
});

describe("move a verse between groups", () => {
  test("a drop removes the source xref and adds the target xref", async () => {
    const db = webLibrary();
    const starred = await handleVerseGroupAction(db, "lib", { action: "set-star", hub: "jhn.1.1", slug: "jhn.1.3" });
    expect(starred.ok).toBe(true);

    const moved = await handleVerseGroupAction(db, "lib", {
      action: "move-member",
      hub: "rom.8.28",
      from: "jhn.1.1",
      slug: "jhn.1.3",
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.statusText).toBe("Moved.");
    expect(moved.group.members.map((member) => member.slug)).toContain("jhn.1.3");

    const notes = await listNotes(db, "lib");
    const groups = await loadVerseGroups(db, "lib", notes);
    const john = groups.find((group) => group.hub === "jhn.1.1");
    const romans = groups.find((group) => group.hub === "rom.8.28");
    expect(john?.members.map((member) => member.slug)).toEqual(expect.arrayContaining(["jhn.1.1", "jhn.1.14", "jhn.1.4"]));
    expect(john?.members.map((member) => member.slug)).not.toContain("jhn.1.3");
    expect(john?.star).toBe("");
    expect(romans?.members.map((member) => member.slug)).toContain("jhn.1.3");

    const source = notes.find((note) => note.slug === "jhn.1.1");
    const carried = notes.find((note) => note.slug === "jhn.1.3");
    expect(source?.attachments.some((row) => row.kind === "xref" && row.slug === "jhn.1.3" && row.source !== "backlink")).toBe(false);
    expect(carried?.attachments.some((row) => row.kind === "xref" && row.slug === "rom.8.28" && row.source === "manual")).toBe(true);

    const same = await handleVerseGroupAction(db, "lib", {
      action: "move-member",
      hub: "rom.8.28",
      from: "rom.8.28",
      slug: "jhn.1.3",
    });
    expect(same.ok).toBe(false);
    if (same.ok) return;
    expect(same.error).toBe("Already in this group.");
  });

  test("dragging the hub verse adds it to the other group and leaves the hub", async () => {
    const db = webLibrary();
    const moved = await handleVerseGroupAction(db, "lib", {
      action: "move-member",
      hub: "rom.8.28",
      from: "jhn.1.1",
      slug: "jhn.1.1",
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const notes = await listNotes(db, "lib");
    const groups = await loadVerseGroups(db, "lib", notes);
    const john = groups.find((group) => group.hub === "jhn.1.1");
    const romans = groups.find((group) => group.hub === "rom.8.28");
    expect(john?.members.map((member) => member.slug)).toEqual(expect.arrayContaining(["jhn.1.1", "jhn.1.14", "jhn.1.3", "jhn.1.4"]));
    expect(romans?.members.map((member) => member.slug)).toContain("jhn.1.1");
    const source = notes.find((note) => note.slug === "jhn.1.1");
    expect(source?.attachments.some((row) => row.slug === "jhn.1.14" && row.source === "manual")).toBe(true);
    expect(source?.attachments.some((row) => row.slug === "rom.8.28" && row.source === "manual")).toBe(true);
  });

  test("removing the link that drops a web under the minimum still stays removed", async () => {
    const db = starLibrary();
    const removed = await handleVerseGroupAction(db, "lib", {
      action: "remove-member",
      hub: "jhn.1.1",
      slug: "jhn.1.14",
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.statusText).toBe("Removed.");
    expect(removed.dissolved).toBe(true);
    expect(removed.group.members.map((member) => member.slug)).not.toContain("jhn.1.14");
    const notes = await listNotes(db, "lib");
    const source = notes.find((note) => note.slug === "jhn.1.1");
    expect(source?.attachments.some((row) => row.slug === "jhn.1.14")).toBe(false);
    expect(source?.attachments.some((row) => row.slug === "jhn.1.3")).toBe(true);
  });

  test("moving the last extra link retires the source group", async () => {
    const db = webLibrary();
    const trimmed = await handleVerseGroupAction(db, "lib", {
      action: "remove-member",
      hub: "jhn.1.1",
      slug: "jhn.1.4",
    });
    expect(trimmed.ok).toBe(true);
    if (!trimmed.ok) return;
    expect(trimmed.dissolved).toBeUndefined();
    const moved = await handleVerseGroupAction(db, "lib", {
      action: "move-member",
      hub: "rom.8.28",
      from: "jhn.1.1",
      slug: "jhn.1.3",
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.sourceDissolved).toBe(true);
    const groups = await loadVerseGroups(db, "lib", await listNotes(db, "lib"));
    expect(groups.some((group) => group.hub === "jhn.1.1")).toBe(false);
    expect(groups.find((group) => group.hub === "rom.8.28")?.members.map((member) => member.slug)).toContain("jhn.1.3");
  });

  test("a missing group tells the reader to refresh, without the word hub", async () => {
    const db = webLibrary();
    const missed = await handleVerseGroupAction(db, "lib", {
      action: "set-star",
      hub: "gen.1.1",
      slug: "gen.1.2",
    });
    expect(missed.ok).toBe(false);
    if (missed.ok) return;
    expect(missed.error).toBe("That topic changed. Refresh and try again.");
  });

  test("a warm move or remove reads the library once and writes in one wave", async () => {
    const inner = webLibrary();
    let queries = 0;
    const db = {
      prepare(sql: string) {
        queries += 1;
        return inner.prepare(sql);
      },
      batch(statements: D1PreparedStatement[]) {
        return inner.batch(statements);
      },
    } as D1Database;
    await handleVerseGroupAction(db, "lib", { action: "set-star", hub: "jhn.1.1", slug: "jhn.1.3" });
    queries = 0;
    const removed = await handleVerseGroupAction(db, "lib", {
      action: "remove-member",
      hub: "jhn.1.1",
      slug: "jhn.1.4",
    });
    expect(removed.ok).toBe(true);
    const removeQueries = queries;
    queries = 0;
    const moved = await handleVerseGroupAction(db, "lib", {
      action: "move-member",
      hub: "rom.8.28",
      from: "jhn.1.1",
      slug: "jhn.1.3",
    });
    expect(moved.ok).toBe(true);
    const moveQueries = queries;
    // Two D1 batches: notes+meta, then the title backfill with the xref writes.
    // The old path listed the library again for every hub check and every xref.
    expect(removeQueries).toBeLessThanOrEqual(8);
    expect(moveQueries).toBeLessThanOrEqual(9);
  });
});
