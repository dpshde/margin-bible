export const outlinerSource = `
function cloneBlocks(blocks) {
  return blocks.map((block) => ({
    id: block.id,
    indent: block.indent,
    text: block.text,
    bullet: block.bullet !== false,
  }));
}

function seedBlocks(blocks, id) {
  if (!blocks || blocks.length === 0) return [{ id, indent: 0, text: "", bullet: true }];
  return cloneBlocks(blocks);
}

function isEmptyBlocks(blocks) {
  return !blocks || blocks.every((block) => !String(block.text || "").trim());
}

function canIndent(blocks, index) {
  if (!blocks || index <= 0 || index >= blocks.length) return false;
  return blocks[index].indent < blocks[index - 1].indent + 1;
}

function subtreeEnd(blocks, index) {
  const base = blocks[index].indent;
  let cursor = index + 1;
  while (cursor < blocks.length && blocks[cursor].indent > base) cursor += 1;
  return cursor;
}

function clampBlocks(blocks) {
  for (let i = 0; i < blocks.length; i += 1) {
    if (i === 0) blocks[i].indent = 0;
    else blocks[i].indent = Math.max(0, Math.min(blocks[i].indent, blocks[i - 1].indent + 1));
    blocks[i].indent = Math.min(32, blocks[i].indent);
  }
  return blocks;
}

function indentBlock(blocks, index, delta) {
  const next = cloneBlocks(blocks);
  if (index < 0 || index >= next.length || !delta) return next;
  if (delta > 0 && !canIndent(next, index)) return next;
  if (delta < 0 && next[index].indent <= 0) return next;
  const end = subtreeEnd(next, index);
  for (let cursor = index; cursor < end; cursor += 1) next[cursor].indent += delta;
  return clampBlocks(next);
}

function applyLeadingSpace(blocks, index) {
  const next = cloneBlocks(blocks);
  const block = next[index];
  if (!block || !String(block.text).startsWith(" ")) return { blocks: next, changed: false };
  if (!canIndent(next, index)) return { blocks: next, changed: false };
  block.text = block.text.replace(/^ +/, "");
  return { blocks: indentBlock(next, index, 1), changed: true };
}

function splitBlock(blocks, index, offset, id) {
  const next = cloneBlocks(blocks);
  const current = next[index];
  const text = String(current.text || "");
  const at = Math.max(0, Math.min(offset, text.length));
  const created = { id, indent: current.indent, text: text.slice(at), bullet: true };
  current.text = text.slice(0, at);
  const end = subtreeEnd(next, index);
  next.splice(end, 0, created);
  clampBlocks(next);
  return { blocks: next, focusIndex: end };
}

function toggleBullet(blocks, index) {
  const next = cloneBlocks(blocks);
  if (!next[index]) return next;
  next[index].bullet = !next[index].bullet;
  return next;
}

function backspaceAtStart(blocks, index) {
  const next = cloneBlocks(blocks);
  const current = next[index];
  if (!current) return { blocks: next, focusIndex: 0 };
  if (current.indent > 0) return { blocks: indentBlock(next, index, -1), focusIndex: index };
  if (current.bullet) {
    current.bullet = false;
    return { blocks: next, focusIndex: index };
  }
  if (index <= 0) return { blocks: next, focusIndex: 0 };
  const previous = next[index - 1];
  const caret = previous.text.length;
  if (!current.text) {
    const end = subtreeEnd(next, index);
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      next[cursor].indent = Math.max(0, next[cursor].indent - 1);
    }
  } else {
    previous.text += current.text;
  }
  next.splice(index, 1);
  if (next.length === 0) next.push({ id: current.id, indent: 0, text: "", bullet: true });
  clampBlocks(next);
  return { blocks: next, focusIndex: index - 1, caret };
}

function noteCovers(note, verse) {
  if (!note || note.kind === "chapter" || note.verseStart == null) return false;
  const last = note.verseEnd == null ? note.verseStart : note.verseEnd;
  return verse >= note.verseStart && verse <= last;
}

function shouldShowTray(expanding, selected, collapsed, hasContent) {
  if (collapsed) return false;
  if (selected) return true;
  if (!hasContent) return false;
  return expanding;
}

function verseSlug(book, chapter, verse) {
  return book.toLowerCase() + "." + chapter + "." + verse;
}

function rangeSlug(book, chapter, start, end) {
  return book.toLowerCase() + "." + chapter + "." + start + "-" + end;
}

function labelVerse(bookName, chapter, verse) {
  return bookName + " " + chapter + ":" + verse;
}

function labelRange(bookName, chapter, start, end) {
  return bookName + " " + chapter + ":" + start + "–" + end;
}

function firstWritable(blocks) {
  return blocks.find((block) => !String(block.text || "").trim()) || blocks[0];
}

function traysForVerse(verse, state) {
  const selection = state.selection;
  const open = Boolean(
    selection && (selection.start === selection.end ? selection.start === verse : selection.end === verse) && !state.collapsed.has(verse),
  );
  const rows = [];
  const seen = new Set();
  function add(slug, label) {
    if (seen.has(slug)) return;
    seen.add(slug);
    rows.push({ slug, label });
  }
  for (const note of state.notes) {
    if (!noteCovers(note, verse)) continue;
    const blocks = state.drafts.get(note.slug) || note.blocks || [];
    const hasContent = !isEmptyBlocks(blocks);
    if (shouldShowTray(state.expanded, open, state.collapsed.has(verse), hasContent)) add(note.slug, note.label);
  }
  if (open && selection.start === selection.end) {
    add(verseSlug(state.book, state.chapter, verse), labelVerse(state.bookName, state.chapter, verse));
  }
  if (open && selection.start !== selection.end && verse === selection.end) {
    add(
      rangeSlug(state.book, state.chapter, selection.start, selection.end),
      labelRange(state.bookName, state.chapter, selection.start, selection.end),
    );
  }
  return rows;
}
`;

export const readerDomSource = `
(() => {
  const bootEl = document.getElementById("reader-boot");
  if (!bootEl) return;
  const boot = JSON.parse(bootEl.textContent || "{}");
  const drafts = new Map();
  for (const note of boot.notes || []) drafts.set(note.slug, seedBlocks(note.blocks, newId()));

  let selection = boot.verseStart == null
    ? null
    : { start: boot.verseStart, end: boot.verseEnd || boot.verseStart };
  let expanded = false;
  let collapsed = new Set();
  let chapterOpen = false;
  let quiet = false;
  let rangeAnchor = null;
  let pendingFocus = null;
  const timers = new Map();

  function newId() {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return "b_" + [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function state() {
    return {
      notes: boot.notes || [],
      drafts,
      selection,
      expanded,
      collapsed,
      book: boot.book,
      chapter: boot.chapter,
      bookName: boot.bookName,
    };
  }

  function ensureDraft(slug) {
    const existing = drafts.get(slug);
    if (existing && existing.length) return existing;
    const stored = (boot.notes || []).find((note) => note.slug === slug);
    const seeded = seedBlocks(stored ? stored.blocks : [], newId());
    drafts.set(slug, seeded);
    return seeded;
  }

  function focusRequest(slug) {
    const blocks = ensureDraft(slug);
    const target = firstWritable(blocks);
    pendingFocus = { slug, blockId: target.id, caret: String(target.text || "").length, scroll: true };
  }

  if (selection) {
    const slug = selection.start === selection.end
      ? verseSlug(boot.book, boot.chapter, selection.start)
      : rangeSlug(boot.book, boot.chapter, selection.start, selection.end);
    focusRequest(slug);
  }

  document.querySelectorAll(".verse-press").forEach((button) => {
    let timer = 0;
    let armed = false;
    button.addEventListener("pointerdown", () => {
      armed = false;
      timer = window.setTimeout(() => {
        armed = true;
        rangeAnchor = Number(button.dataset.verse);
        render();
      }, 350);
    });
    const clear = () => window.clearTimeout(timer);
    button.addEventListener("pointerup", clear);
    button.addEventListener("pointercancel", clear);
    button.addEventListener("pointerleave", clear);
    button.addEventListener("click", (event) => {
      const verse = Number(button.dataset.verse);
      if (armed) {
        armed = false;
        return;
      }
      if (event.shiftKey && selection && selection.start === selection.end && selection.start !== verse) {
        rangeAnchor = selection.start;
      }
      openVerse(verse);
    });
  });

  document.querySelector("[data-action=chapter]")?.addEventListener("click", () => {
    chapterOpen = !chapterOpen;
    if (chapterOpen) focusRequest(boot.chapterSlug);
    else pendingFocus = null;
    render();
  });
  document.querySelector("[data-action=expand]")?.addEventListener("click", () => {
    expanded = !expanded;
    collapsed = new Set();
    render();
  });
  document.querySelector("[data-action=quiet]")?.addEventListener("click", () => {
    quiet = !quiet;
    render();
  });

  function openVerse(verse) {
    if (rangeAnchor != null && rangeAnchor !== verse) {
      const start = Math.min(rangeAnchor, verse);
      const end = Math.max(rangeAnchor, verse);
      rangeAnchor = null;
      collapsed.delete(verse);
      selection = { start, end };
      const slug = rangeSlug(boot.book, boot.chapter, start, end);
      focusRequest(slug);
      history.replaceState(null, "", "/" + slug);
      render();
      return;
    }
    if (rangeAnchor === verse) return;
    rangeAnchor = null;
    collapsed.delete(verse);
    selection = { start: verse, end: verse };
    const slug = verseSlug(boot.book, boot.chapter, verse);
    focusRequest(slug);
    history.replaceState(null, "", "/" + slug);
    render();
  }

  function hasNote(verse) {
    return (boot.notes || []).some((note) => {
      if (!noteCovers(note, verse)) return false;
      return !isEmptyBlocks(drafts.get(note.slug) || note.blocks);
    });
  }

  function render() {
    document.body.classList.toggle("is-quiet", quiet);
    const title = document.getElementById("title");
    if (title) {
      title.textContent = selection
        ? (selection.start === selection.end
          ? labelVerse(boot.bookName, boot.chapter, selection.start)
          : labelRange(boot.bookName, boot.chapter, selection.start, selection.end))
        : boot.chapterLabel;
    }
    const chapterPressed = document.querySelector("[data-action=chapter]");
    const expandPressed = document.querySelector("[data-action=expand]");
    const quietPressed = document.querySelector("[data-action=quiet]");
    chapterPressed?.setAttribute("aria-pressed", chapterOpen ? "true" : "false");
    expandPressed?.setAttribute("aria-pressed", expanded ? "true" : "false");
    quietPressed?.setAttribute("aria-pressed", quiet ? "true" : "false");
    if (expandPressed) {
      const any = (boot.notes || []).some((note) => note.kind !== "chapter" && !isEmptyBlocks(drafts.get(note.slug) || note.blocks));
      expandPressed.disabled = !any;
    }
    const hint = document.getElementById("range-hint");
    if (hint) hint.hidden = rangeAnchor == null;

    const slot = document.getElementById("chapter-slot");
    if (slot) {
      slot.replaceChildren();
      if (chapterOpen) slot.append(trayElement(boot.chapterSlug, boot.chapterLabel));
    }

    document.querySelectorAll(".verse").forEach((verseEl) => {
      const verse = Number(verseEl.dataset.verse);
      const open = Boolean(selection && (selection.start === selection.end ? selection.start === verse : selection.end === verse));
      const spanned = Boolean(selection && verse >= selection.start && verse <= selection.end);
      verseEl.classList.toggle("is-open", open);
      verseEl.classList.toggle("is-span", spanned);
      verseEl.classList.toggle("has-note", hasNote(verse));
      let host = verseEl.querySelector(".trays");
      if (!host) {
        host = document.createElement("div");
        host.className = "trays";
        verseEl.append(host);
      }
      host.replaceChildren();
      for (const row of traysForVerse(verse, state())) {
        ensureDraft(row.slug);
        host.append(trayElement(row.slug, row.label));
      }
    });

    const keep = pendingFocus;
    pendingFocus = null;
    if (keep) focusBlock(keep.slug, keep.blockId, keep.caret, keep.scroll);
  }

  function trayElement(slug, label) {
    const tray = document.createElement("section");
    tray.className = "note-tray";
    tray.dataset.slug = slug;
    const head = document.createElement("p");
    head.className = "tray-label";
    const link = document.createElement("a");
    link.href = "https://route.bible/" + slug;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    head.append(link);
    const outliner = document.createElement("div");
    outliner.className = "outliner";
    const blocks = drafts.get(slug) || [];
    for (const block of blocks) {
      const row = document.createElement("div");
      row.className = "oblock" + (block.bullet ? " is-bullet" : "");
      row.dataset.blockId = block.id;
      row.style.setProperty("--depth", String(block.indent));
      const bullet = document.createElement("button");
      bullet.type = "button";
      bullet.className = "obullet";
      bullet.setAttribute("aria-label", block.bullet ? "Remove bullet" : "Add bullet");
      bullet.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const index = indexOf(slug, block.id);
        if (index < 0) return;
        drafts.set(slug, toggleBullet(drafts.get(slug), index));
        pendingFocus = { slug, blockId: block.id, caret: caretOffset(row.querySelector(".otext")), scroll: false };
        scheduleSave(slug);
        render();
      });
      const text = document.createElement("div");
      text.className = "otext";
      text.contentEditable = "true";
      text.setAttribute("role", "textbox");
      text.setAttribute("aria-label", label);
      text.spellcheck = true;
      fillText(text, block.text);
      text.addEventListener("beforeinput", (event) => onBeforeInput(event, slug, block.id));
      text.addEventListener("keydown", (event) => onKeydown(event, slug, block.id));
      text.addEventListener("input", () => onInput(slug, block.id, text));
      row.append(bullet, text);
      outliner.append(row);
    }
    outliner.addEventListener("mousedown", (event) => {
      if (event.target !== outliner) return;
      const current = drafts.get(slug) || [];
      const target = firstWritable(current);
      if (!target) return;
      event.preventDefault();
      focusBlock(slug, target.id, String(target.text || "").length, false);
    });
    tray.append(head, outliner);
    return tray;
  }

  function indexOf(slug, id) {
    return (drafts.get(slug) || []).findIndex((block) => block.id === id);
  }

  function fillText(el, text) {
    el.textContent = text || "";
    if (!text) el.append(document.createElement("br"));
  }

  function readText(el) {
    return (el.innerText || "").replace(/\\u00a0/g, " ").replace(/\\n$/, "");
  }

  function caretOffset(el) {
    if (!el) return 0;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.focusNode)) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }

  function setCaret(el, offset) {
    const node = el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE
      ? el.firstChild
      : el.appendChild(document.createTextNode(""));
    const at = Math.max(0, Math.min(offset, node.textContent.length));
    const range = document.createRange();
    range.setStart(node, at);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function focusBlock(slug, id, caret, scroll) {
    const tray = document.querySelector('.note-tray[data-slug="' + CSS.escape(slug) + '"]');
    const el = tray?.querySelector('[data-block-id="' + CSS.escape(id) + '"] .otext');
    if (!el) return;
    el.focus();
    setCaret(el, caret);
    if (scroll) tray.scrollIntoView({ block: "center" });
  }

  let editLock = false;
  function lockEdit() {
    editLock = true;
    window.setTimeout(() => { editLock = false; }, 0);
  }
  function onKeydown(event, slug, id) {
    if (event.isComposing || event.key !== "Enter") return;
    event.preventDefault();
    splitAt(slug, id);
  }

  function onBeforeInput(event, slug, id) {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;
    const index = indexOf(slug, id);
    if (index < 0) return;
    if (event.inputType === "insertParagraph") {
      event.preventDefault();
      splitAt(slug, id);
      return;
    }
    if (event.inputType === "insertText" && event.data === " " && caretOffset(el) === 0 && canIndent(drafts.get(slug), index)) {
      event.preventDefault();
      drafts.set(slug, indentBlock(drafts.get(slug), index, 1));
      pendingFocus = { slug, blockId: id, caret: 0, scroll: false };
      scheduleSave(slug);
      render();
      return;
    }
    if (event.inputType === "deleteContentBackward" && caretOffset(el) === 0) {
      event.preventDefault();
      mergeAt(slug, id);
    }
  }

  function onInput(slug, id, el) {
    if (editLock) return;
    const index = indexOf(slug, id);
    if (index < 0) return;
    const blocks = drafts.get(slug);
    const text = readText(el);
    const caret = caretOffset(el);
    const leading = (/^ +/.exec(text) || [""])[0].length;
    if (leading > 0 && caret <= leading) {
      blocks[index].text = text;
      const applied = applyLeadingSpace(blocks, index);
      if (applied.changed) {
        drafts.set(slug, applied.blocks);
        pendingFocus = { slug, blockId: applied.blocks[index].id, caret: 0, scroll: false };
        scheduleSave(slug);
        render();
        return;
      }
    }
    blocks[index].text = text.replace(/\\n/g, "");
    scheduleSave(slug);
  }

  function splitAt(slug, id) {
    if (editLock) return;
    lockEdit();
    const index = indexOf(slug, id);
    const el = document.querySelector('.note-tray[data-slug="' + CSS.escape(slug) + '"] [data-block-id="' + CSS.escape(id) + '"] .otext');
    if (index < 0) return;
    const offset = el ? caretOffset(el) : (drafts.get(slug)[index].text || "").length;
    const created = newId();
    const result = splitBlock(drafts.get(slug), index, offset, created);
    drafts.set(slug, result.blocks);
    pendingFocus = { slug, blockId: result.blocks[result.focusIndex].id, caret: 0, scroll: false };
    scheduleSave(slug);
    render();
  }

  function mergeAt(slug, id) {
    const index = indexOf(slug, id);
    if (index < 0) return;
    const result = backspaceAtStart(drafts.get(slug), index);
    drafts.set(slug, result.blocks);
    const focus = result.blocks[result.focusIndex];
    pendingFocus = { slug, blockId: focus.id, caret: result.caret == null ? 0 : result.caret, scroll: false };
    scheduleSave(slug);
    render();
  }

  function scheduleSave(slug) {
    const existing = timers.get(slug);
    if (existing) window.clearTimeout(existing);
    timers.set(slug, window.setTimeout(() => persist(slug), 400));
  }

  async function persist(slug) {
    const blocks = drafts.get(slug);
    if (!blocks) return;
    const status = document.getElementById("save-status");
    if (status) status.textContent = "Saving";
    try {
      const response = await fetch("/api/notes/" + slug, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ blocks }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (status) status.textContent = "Not saved";
        return;
      }
      if (Array.isArray(data.chapterNotes)) boot.notes = data.chapterNotes;
      if (status) status.textContent = data.deleted ? "Cleared" : "Saved";
      document.querySelectorAll(".verse").forEach((verseEl) => {
        verseEl.classList.toggle("has-note", hasNote(Number(verseEl.dataset.verse)));
      });
      const expandPressed = document.querySelector("[data-action=expand]");
      if (expandPressed) {
        const any = (boot.notes || []).some((note) => note.kind !== "chapter" && !isEmptyBlocks(drafts.get(note.slug) || note.blocks));
        expandPressed.disabled = !any;
      }
    } catch {
      if (status) status.textContent = "Not saved";
    }
  }

  render();
})();
`;

export function readerClientSource(): string {
  return `${outlinerSource}\n${readerDomSource}`;
}

export function loadOutliner(): {
  seedBlocks: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], id: string) => { id: string; indent: number; text: string; bullet: boolean }[];
  splitBlock: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], index: number, offset: number, id: string) => { blocks: { id: string; indent: number; text: string; bullet: boolean }[]; focusIndex: number };
  indentBlock: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], index: number, delta: number) => { id: string; indent: number; text: string; bullet: boolean }[];
  canIndent: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], index: number) => boolean;
  applyLeadingSpace: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], index: number) => { blocks: { id: string; indent: number; text: string; bullet: boolean }[]; changed: boolean };
  toggleBullet: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], index: number) => { id: string; indent: number; text: string; bullet: boolean }[];
  backspaceAtStart: (blocks: { id: string; indent: number; text: string; bullet: boolean }[], index: number) => { blocks: { id: string; indent: number; text: string; bullet: boolean }[]; focusIndex: number; caret?: number };
  traysForVerse: (verse: number, state: {
    notes: { slug: string; label: string; kind: string; verseStart: number | null; verseEnd: number | null; blocks: { id: string; indent: number; text: string; bullet: boolean }[] }[];
    drafts: Map<string, { id: string; indent: number; text: string; bullet: boolean }[]>;
    selection: { start: number; end: number } | null;
    expanded: boolean;
    collapsed: Set<number>;
    book: string;
    chapter: number;
    bookName: string;
  }) => { slug: string; label: string }[];
  isEmptyBlocks: (blocks: { text: string }[]) => boolean;
} {
  const loader = new Function(`${outlinerSource}\nreturn { seedBlocks, splitBlock, indentBlock, canIndent, applyLeadingSpace, toggleBullet, backspaceAtStart, traysForVerse, isEmptyBlocks };`);
  return loader();
}
