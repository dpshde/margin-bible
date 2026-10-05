import { testamentCodes } from "./books";

export type SearchChordEvent = {
  key?: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
};

/** Cmd+K on Apple platforms, Ctrl+K elsewhere. Slash and j stay separate. */
export function isSearchChord(event: SearchChordEvent, platform: string): boolean {
  if (event.repeat) return false;
  const key = event.key || "";
  if (key !== "k" && key !== "K" && event.code !== "KeyK") return false;
  if (event.altKey || event.shiftKey) return false;
  const mac = /Mac|iPhone|iPad|iPod/i.test(platform);
  if (mac) return Boolean(event.metaKey) && !event.ctrlKey;
  return Boolean(event.ctrlKey) && !event.metaKey;
}

/** Jump form markup + browser combobox. Mirrors Rails search_controller + /api/jump-suggest. */

export function jumpFormHtml(): string {
  return `<form class="jump" action="/jump" method="get" role="search">
    <label class="sr-only">Search scripture</label>
    <div class="jump-field">
      <div class="jump-input-row">
        <input
          name="q"
          type="search"
          placeholder="John 3:16"
          autocomplete="off"
          spellcheck="false"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
        >
        <button type="button" class="jump-clear" hidden aria-label="Clear">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31 61.66 205.66a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66A8 8 0 0 1 61.66 50.34L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>
        </button>
      </div>
      <ul class="suggest" role="listbox" hidden></ul>
    </div>
  </form>`;
}

/**
 * Highlight helpers embedded in the page.
 * Hidden Arrow offsets, marked snippets, or matched terms win.
 * Otherwise query words are marked whole-word, case-insensitive, with a light stem
 * (lives/life, trees/tree) so the orange marks survive without the local index.
 */
export function searchHighlightSource(): string {
  return String.raw`function stemLight(word) {
  let w = String(word || "").toLowerCase().replace(/['’]/g, "");
  if (w.length < 3) return w;
  if (w.endsWith("ves") && w.length > 4) w = w.slice(0, -3) + "f";
  else if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("es") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}
function queryStems(query) {
  const words = String(query || "").toLowerCase().match(/[a-z0-9']+/g) || [];
  const skip = { of: 1, the: 1, and: 1, to: 1, a: 1, an: 1, or: 1, in: 1, on: 1, for: 1 };
  const stems = [];
  const seen = {};
  for (const word of words) {
    if (word.length < 2 || skip[word]) continue;
    const stem = stemLight(word);
    if (stem.length < 3 || seen[stem]) continue;
    seen[stem] = 1;
    stems.push(stem);
  }
  return stems;
}
function markWords(text, accept) {
  const raw = String(text || "");
  const re = new RegExp("\\b[A-Za-z0-9']+\\b", "g");
  let out = "";
  let cursor = 0;
  let match;
  while ((match = re.exec(raw))) {
    out += escape(raw.slice(cursor, match.index));
    const word = match[0];
    out += accept(word) ? '<mark class="search-mark">' + escape(word) + "</mark>" : escape(word);
    cursor = match.index + word.length;
  }
  out += escape(raw.slice(cursor));
  return out;
}
function highlightQuery(text, query) {
  const stems = queryStems(query);
  if (!stems.length) return escape(text);
  const wanted = {};
  for (const stem of stems) wanted[stem] = 1;
  return markWords(text, (word) => Boolean(wanted[stemLight(word)]));
}
function highlightExact(text, terms) {
  const wanted = {};
  for (const term of terms) {
    const key = String(term || "").toLowerCase();
    if (key) wanted[key] = 1;
  }
  if (!Object.keys(wanted).length) return "";
  return markWords(text, (word) => Boolean(wanted[word.toLowerCase()]));
}
function offsetList(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const out = [];
  for (const item of value) {
    let start = null;
    let end = null;
    if (Array.isArray(item) && item.length >= 2 && typeof item[0] === "number" && typeof item[1] === "number") {
      start = item[0];
      end = item[1];
    } else if (item && typeof item === "object" && typeof item.start === "number" && typeof item.end === "number") {
      start = item.start;
      end = item.end;
    } else if (item && typeof item === "object" && typeof item.offset === "number" && typeof item.length === "number") {
      start = item.offset;
      end = item.offset + item.length;
    } else return null;
    if (end > start) out.push([start, end]);
  }
  return out.length ? out : null;
}
function applyOffsets(text, ranges) {
  const raw = String(text || "");
  const sorted = ranges
    .map((pair) => [Math.max(0, pair[0]), Math.min(raw.length, pair[1])])
    .filter((pair) => pair[1] > pair[0])
    .sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const pair of sorted) {
    if (pair[0] < cursor) continue;
    out += escape(raw.slice(cursor, pair[0]));
    out += '<mark class="search-mark">' + escape(raw.slice(pair[0], pair[1])) + "</mark>";
    cursor = pair[1];
  }
  out += escape(raw.slice(cursor));
  return out;
}
function sanitizeMarks(html) {
  const parts = String(html).split(/(<\/?\s*(?:mark|em|strong|b)\b[^>]*>)/gi);
  let open = false;
  let out = "";
  for (const part of parts) {
    if (/^<\s*(mark|em|strong|b)\b/i.test(part)) {
      open = true;
      continue;
    }
    if (/^<\s*\/\s*(mark|em|strong|b)\b/i.test(part)) {
      open = false;
      continue;
    }
    const safe = escape(part.replace(/<[^>]+>/g, ""));
    out += open ? '<mark class="search-mark">' + safe + "</mark>" : safe;
  }
  return out;
}
function markedString(value, fullText) {
  if (typeof value !== "string" || !/<\s*\/?\s*(mark|em|strong|b)\b/i.test(value)) return "";
  const plain = value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const full = String(fullText || "").trim();
  if (!full || plain === full) return sanitizeMarks(value);
  const terms = [];
  const re = new RegExp("<\\s*(?:mark|em|strong|b)\\b[^>]*>([\\s\\S]*?)<\\s*\\/\\s*(?:mark|em|strong|b)\\s*>", "gi");
  let found;
  while ((found = re.exec(value))) {
    const term = found[1].replace(/<[^>]+>/g, "").trim();
    if (term) terms.push(term);
  }
  return terms.length ? highlightExact(fullText, terms) : "";
}
function termList(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const out = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
    else if (item && typeof item.text === "string" && item.text.trim()) out.push(item.text.trim());
    else return null;
  }
  return out;
}
function highlightFromHiddenArrow(item) {
  if (!item) return "";
  const text = String(item.text || "");
  const offsets = offsetList(item.highlights) || offsetList(item.spans) || offsetList(item.matches) || offsetList(item.match);
  if (offsets) return applyOffsets(text, offsets);
  const marked = markedString(item.highlight, text) || markedString(item.highlighted, text) || markedString(item.snippet, text);
  if (marked) return marked;
  const terms = termList(item.matches) || termList(item.match) || termList(item.highlights);
  if (terms) return highlightExact(text, terms);
  return "";
}
`;
}

/** Browser jump combobox (string). Idempotent — safe to call after SPA injects a new form.jump. */
export function jumpScript(): string {
  const otBooks = JSON.stringify(testamentCodes().ot.map((code) => code.toLowerCase()));
  const ntBooks = JSON.stringify(testamentCodes().nt.map((code) => code.toLowerCase()));
  return `(() => {

  const OT_BOOKS = ${otBooks};
  const NT_BOOKS = ${ntBooks};
  let hits = [];
  let selected = -1;
  let seq = 0;
  let suggestSeq = 0;
  let timer = null;
  let submittedQuery = "";
  let searchTestament = "all";
  let scriptureSearchActive = false;
  let cachedSearch = null;
  let searchState = false;
  let closeViaPop = false;
  let restoreQueryOnPop = false;
  let suggestTopics = [];
  let suggestAttempted = false;
  let suggestToken = 0;

  function marginPathFromRouteHref(href) {
    if (href == null) return null;
    const raw = String(href).trim();
    if (!raw) return null;
    let url;
    try { url = new URL(raw); } catch (_) { return null; }
    const host = url.hostname.toLowerCase().replace(/^www\\./, "");
    if (host !== "route.bible") return null;
    let slug = "";
    try { slug = decodeURIComponent(url.pathname).replace(/^\\/+|\\/+$/g, "").toLowerCase(); }
    catch (_) { return null; }
    if (!/^(?:[1-3][a-z]{2}|[a-z]{2,3})\\.\\d+(?:\\.\\d+(?:-\\d+)?)?$/.test(slug)) return null;
    return "/" + slug;
  }

  function syncKeyboardInset() {
    const vv = window.visualViewport;
    const covered = vv ? Math.max(0, window.innerHeight - vv.offsetTop - vv.height) : 0;
    const root = document.documentElement.style;
    root.setProperty("--keyboard-inset", covered + "px");
    root.setProperty("--vv-top", (vv ? vv.offsetTop : 0) + "px");
    root.setProperty("--vv-height", (vv ? vv.height : window.innerHeight) + "px");
  }
  if (window.visualViewport && !window.__marginKeyboardInset) {
    window.__marginKeyboardInset = true;
    window.visualViewport.addEventListener("resize", syncKeyboardInset);
    window.visualViewport.addEventListener("scroll", syncKeyboardInset);
    syncKeyboardInset();
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function searchRoot() {
    return document.querySelector(".search-modal");
  }

  function searchInput() {
    const modal = searchRoot();
    return modal ? modal.querySelector('input[type="search"]') : null;
  }

  function searchList() {
    const modal = searchRoot();
    return modal ? modal.querySelector("ul.search-modal-list") : null;
  }

  function normalizeTestament(value) {
    return value === "nt" || value === "ot" ? value : "all";
  }

  function testamentLabel(value) {
    if (value === "nt") return "NT";
    if (value === "ot") return "OT";
    return "All";
  }

  function testamentFromLocation() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has("testament")) return null;
      return normalizeTestament(url.searchParams.get("testament"));
    } catch (_) {
      return null;
    }
  }

  function testamentMenu() {
    return document.getElementById("search-testament-menu");
  }

  function paintTestament() {
    const label = testamentLabel(searchTestament);
    document.querySelectorAll(".search-testament-label").forEach((el) => {
      el.textContent = label;
    });
    document.querySelectorAll(".search-testament-btn").forEach((el) => {
      el.setAttribute("aria-label", "Select testament, " + label);
    });
    const menu = testamentMenu();
    if (!menu) return;
    menu.querySelectorAll(".search-testament-option").forEach((el) => {
      const on = el.getAttribute("data-value") === searchTestament;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function syncTestamentFromStorage() {
    const fromUrl = testamentFromLocation();
    if (fromUrl) searchTestament = fromUrl;
    else {
      const cache = readSearchCache();
      if (cache) searchTestament = normalizeTestament(cache.testament);
    }
    paintTestament();
  }

  function syncTestamentUrl() {
    let url;
    try { url = new URL(location.href); } catch (_) { return; }
    if (searchTestament === "all") url.searchParams.delete("testament");
    else url.searchParams.set("testament", searchTestament);
    const nextHref = url.pathname + url.search + url.hash;
    const current = location.pathname + location.search + location.hash;
    if (nextHref === current) return;
    history.replaceState(history.state, "", nextHref);
  }

  function setTestamentSheet(open) {
    const sheet = document.getElementById("search-testament-sheet");
    const more = document.querySelector(".search-testament-more");
    if (sheet) sheet.hidden = !open;
    if (more) more.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function placeTestamentMenu() {
    const menu = testamentMenu();
    const btn = menu && menu._anchor;
    if (!menu || !btn || menu.hidden) return;
    const rect = btn.getBoundingClientRect();
    const vv = window.visualViewport;
    const top = rect.bottom + 4 + (vv ? vv.offsetTop : 0);
    const right = (vv ? vv.offsetLeft + vv.width : window.innerWidth) - rect.right;
    menu.style.top = top + "px";
    menu.style.right = Math.max(8, right) + "px";
    menu.style.left = "auto";
  }

  function closeTestamentMenu() {
    const menu = testamentMenu();
    if (!menu || menu.hidden) return false;
    menu.hidden = true;
    menu._anchor = null;
    document.querySelectorAll(".search-testament-btn").forEach((el) => {
      el.setAttribute("aria-expanded", "false");
    });
    return true;
  }

  function openTestamentMenu(btn) {
    const menu = testamentMenu();
    if (!menu || !btn) return;
    menu.hidden = false;
    menu._anchor = btn;
    document.querySelectorAll(".search-testament-btn").forEach((el) => {
      el.setAttribute("aria-expanded", el === btn ? "true" : "false");
    });
    paintTestament();
    const options = [...menu.querySelectorAll(".search-testament-option")];
    options.forEach((el) => el.classList.remove("is-active"));
    const current = options.find((el) => el.getAttribute("data-value") === searchTestament) || options[0];
    if (current) current.classList.add("is-active");
    placeTestamentMenu();
  }

  function moveTestament(delta) {
    const menu = testamentMenu();
    if (!menu || menu.hidden) return;
    const options = [...menu.querySelectorAll(".search-testament-option")];
    if (!options.length) return;
    let index = options.findIndex((el) => el.classList.contains("is-active"));
    if (index < 0) index = 0;
    index = (index + delta + options.length) % options.length;
    options.forEach((el, i) => el.classList.toggle("is-active", i === index));
  }

  function scriptureBook(path) {
    return String(path || "").replace(/^\\/+/, "").split(".")[0].toLowerCase();
  }

  function keepScripture(path) {
    if (searchTestament === "all") return true;
    const book = scriptureBook(path);
    const list = searchTestament === "nt" ? NT_BOOKS : OT_BOOKS;
    return list.indexOf(book) !== -1;
  }

  function rerunScriptureSearch() {
    const input = searchInput();
    const q = input ? String(input.value || "").trim() : "";
    if (!q || q !== submittedQuery || !scriptureSearchActive) return;
    const my = ++seq;
    showSearchSkeletons();
    searchScripture(q, my);
  }

  function chooseTestament(value, fromSheet) {
    const next = normalizeTestament(value);
    const changed = next !== searchTestament;
    searchTestament = next;
    paintTestament();
    syncTestamentUrl();
    closeTestamentMenu();
    if (fromSheet) setTestamentSheet(false);
    if (!changed) return;
    rerunScriptureSearch();
  }

  function mirrorHeader(value) {
    const forms = [...document.querySelectorAll("form.jump")];
    const visible = forms.find((f) => f.offsetParent !== null) || forms[0];
    if (!visible) return;
    const header = visible.querySelector('input[type="search"]');
    if (header) header.value = value;
    const clearBtn = visible.querySelector("button.jump-clear");
    if (clearBtn) clearBtn.hidden = !String(value || "").length;
  }

  function openSearchModal() {
    const modal = ensureSearchModal();
    const opening = modal.hidden;
    modal.hidden = false;
    document.documentElement.classList.add("search-modal-open");
    document.querySelectorAll("form.jump").forEach((form) => form.classList.add("is-open"));
    const panel = modal.querySelector(".search-modal-panel");
    if (panel) {
      panel.style.transform = "";
      panel.style.transition = "";
    }
    if (opening && !searchState) {
      const prev = history.state && typeof history.state === "object" ? history.state : {};
      history.pushState(Object.assign({}, prev, { marginSearch: 1 }), "");
      searchState = true;
    }
    if (opening) {
      suggestAttempted = false;
      loadTopicSuggestions();
    }
  }

  function closeSearchModal() {
    const modal = searchRoot();
    const wasOpen = Boolean(modal && !modal.hidden);
    if (modal) modal.hidden = true;
    document.documentElement.classList.remove("search-modal-open");
    document.querySelectorAll("form.jump").forEach((form) => form.classList.remove("is-open"));
    const panel = modal && modal.querySelector(".search-modal-panel");
    if (panel) {
      panel.style.transform = "";
      panel.style.transition = "";
    }
    if (timer) clearTimeout(timer);
    suggestSeq += 1;
    suggestToken += 1;
    suggestAttempted = false;
    suggestTopics = [];
    closeTestamentMenu();
    setTestamentSheet(false);
    hideTopicChips();
    hideHistory();
    const cache = readSearchCache();
    if (cache && cache.query) mirrorHeader(cache.query);
    if (wasOpen && searchState && !closeViaPop) {
      searchState = false;
      restoreQueryOnPop = true;
      history.back();
    } else if (closeViaPop) {
      searchState = false;
    }
  }

  function bindSheetSwipe(bar, results, panel) {
    const limit = 80;
    let active = false;
    let kind = "";
    let startY = 0;
    let dy = 0;
    let pointerId = 0;

    function phoneSheet() {
      return window.matchMedia("(max-width: 640px)").matches;
    }
    function shift(y) {
      const next = Math.max(0, y);
      panel.style.transition = "none";
      panel.style.transform = next ? "translate3d(0," + next + "px,0)" : "";
    }
    function endDrag(distance) {
      active = false;
      kind = "";
      if (distance >= limit) {
        panel.style.transition = "";
        panel.style.transform = "";
        closeSearchModal();
        return;
      }
      panel.style.transition = "transform 180ms ease";
      panel.style.transform = "";
    }

    bar.addEventListener("pointerdown", (event) => {
      if (!phoneSheet() || event.button) return;
      if (event.target.closest("button, .search-testament")) return;
      active = true;
      kind = "bar";
      startY = event.clientY;
      dy = 0;
      pointerId = event.pointerId;
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => {
      if (!active || kind !== "bar" || event.pointerId !== pointerId) return;
      dy = event.clientY - startY;
      if (dy > 0) shift(dy);
    });
    bar.addEventListener("pointerup", (event) => {
      if (!active || kind !== "bar" || event.pointerId !== pointerId) return;
      endDrag(event.clientY - startY);
    });
    bar.addEventListener("pointercancel", () => {
      if (active && kind === "bar") endDrag(0);
    });

    results.addEventListener("touchstart", (event) => {
      if (!phoneSheet() || event.touches.length !== 1 || results.scrollTop > 0) return;
      active = true;
      kind = "results";
      startY = event.touches[0].clientY;
      dy = 0;
    }, { passive: true });
    results.addEventListener("touchmove", (event) => {
      if (!active || kind !== "results" || event.touches.length !== 1) return;
      if (results.scrollTop > 0) {
        endDrag(0);
        return;
      }
      dy = event.touches[0].clientY - startY;
      if (dy > 0) {
        event.preventDefault();
        shift(dy);
      }
    }, { passive: false });
    results.addEventListener("touchend", () => {
      if (!active || kind !== "results") return;
      endDrag(dy);
    });
    results.addEventListener("touchcancel", () => {
      if (active && kind === "results") endDrag(0);
    });
  }

  function refetchCachedTestament(cache) {
    if (!cache || !cache.scripture) return false;
    if (normalizeTestament(cache.testament) === searchTestament) return false;
    const my = ++seq;
    showSearchSkeletons();
    searchScripture(cache.query, my);
    return true;
  }

  function revealCachedSearch() {
    syncTestamentFromStorage();
    const cache = readSearchCache();
    if (!cache || !cache.query) return false;
    const input = searchInput();
    if (!input) return false;
    input.value = cache.query;
    mirrorHeader(cache.query);
    submittedQuery = cache.query;
    scriptureSearchActive = Boolean(cache.scripture);
    if (refetchCachedTestament(cache)) return true;
    const list = searchList();
    const waiting = list && list.querySelector(".suggest-skeleton");
    const painted = list && list.querySelector("button.search-result");
    if (waiting || (painted && cache.hits.length)) openSearchModal();
    else render({ hits: cache.hits });
    return true;
  }

  function openFromHeader(header) {
    ensureSearchModal();
    const input = searchInput();
    if (!input) return;
    if (!revealCachedSearch()) {
      const value = header ? String(header.value || "") : "";
      if (value) input.value = value;
      openSearchModal();
    }
    if (document.activeElement !== input) {
      input.focus();
      input.select();
    }
  }

  function ensureSearchModal() {
    const existing = searchRoot();
    if (existing) return existing;
    const modal = document.createElement("div");
    modal.className = "search-modal";
    modal.hidden = true;
    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "search-modal-backdrop";
    backdrop.setAttribute("aria-label", "Close search");
    const panel = document.createElement("div");
    panel.className = "search-modal-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Search scripture");
    const searchForm = document.createElement("form");
    searchForm.className = "search-modal-form";
    searchForm.setAttribute("role", "search");
    const bar = document.createElement("div");
    bar.className = "search-modal-bar";
    const icon = document.createElement("span");
    icon.className = "search-modal-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2 20 20"/></svg>';
    const testamentWrap = document.createElement("div");
    testamentWrap.className = "search-testament search-testament-desktop";
    const testamentBtn = document.createElement("button");
    testamentBtn.type = "button";
    testamentBtn.className = "search-testament-btn";
    testamentBtn.setAttribute("aria-haspopup", "listbox");
    testamentBtn.setAttribute("aria-expanded", "false");
    testamentBtn.setAttribute("aria-controls", "search-testament-menu");
    const testamentLabel = document.createElement("span");
    testamentLabel.className = "search-testament-label";
    testamentBtn.appendChild(testamentLabel);
    testamentWrap.appendChild(testamentBtn);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "search-testament-more";
    more.setAttribute("aria-label", "Testament options");
    more.setAttribute("aria-expanded", "false");
    more.setAttribute("aria-controls", "search-testament-sheet");
    more.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
    const sheet = document.createElement("div");
    sheet.className = "search-testament-sheet";
    sheet.id = "search-testament-sheet";
    sheet.hidden = true;
    const sheetLabel = document.createElement("span");
    sheetLabel.className = "search-testament-sheet-label";
    sheetLabel.textContent = "Testament:";
    const sheetBtn = document.createElement("button");
    sheetBtn.type = "button";
    sheetBtn.className = "search-testament-btn";
    sheetBtn.setAttribute("aria-haspopup", "listbox");
    sheetBtn.setAttribute("aria-expanded", "false");
    sheetBtn.setAttribute("aria-controls", "search-testament-menu");
    const sheetValue = document.createElement("span");
    sheetValue.className = "search-testament-label";
    sheetBtn.appendChild(sheetValue);
    sheet.appendChild(sheetLabel);
    sheet.appendChild(sheetBtn);
    const menu = document.createElement("div");
    menu.className = "search-testament-menu";
    menu.id = "search-testament-menu";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Testament");
    for (const pair of [["all", "All"], ["nt", "NT"], ["ot", "OT"]]) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-testament-option";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", pair[0]);
      const check = document.createElement("span");
      check.className = "search-testament-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "\\u2713";
      const name = document.createElement("span");
      name.textContent = pair[1];
      item.appendChild(check);
      item.appendChild(name);
      menu.appendChild(item);
    }
    const input = document.createElement("input");
    input.id = "search-modal-q";
    input.name = "q";
    input.type = "search";
    input.placeholder = "Search or verse reference";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "search-modal-list");
    const list = document.createElement("ul");
    list.className = "search-modal-list";
    list.id = "search-modal-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    const footer = document.createElement("p");
    footer.className = "search-modal-footer";
    footer.textContent = "BSB";
    const results = document.createElement("div");
    results.className = "search-modal-results";
    const history = document.createElement("div");
    history.className = "search-history";
    history.hidden = true;
    const historyLabel = document.createElement("p");
    historyLabel.className = "search-history-label";
    historyLabel.textContent = "Recent";
    const historyChips = document.createElement("div");
    historyChips.className = "search-suggest-chips search-history-chips";
    historyChips.setAttribute("role", "group");
    historyChips.setAttribute("aria-label", "Recent searches");
    history.appendChild(historyLabel);
    history.appendChild(historyChips);
    const topics = document.createElement("div");
    topics.className = "search-suggest";
    topics.hidden = true;
    const topicChips = document.createElement("div");
    topicChips.className = "search-suggest-chips";
    topicChips.setAttribute("role", "group");
    topics.appendChild(topicChips);
    bar.appendChild(icon);
    bar.appendChild(input);
    bar.appendChild(testamentWrap);
    bar.appendChild(more);
    results.appendChild(list);
    results.appendChild(footer);
    searchForm.appendChild(bar);
    searchForm.appendChild(sheet);
    searchForm.appendChild(history);
    searchForm.appendChild(topics);
    searchForm.appendChild(results);
    panel.appendChild(searchForm);
    modal.appendChild(backdrop);
    modal.appendChild(panel);
    modal.appendChild(menu);
    paintTestament();
    function toggleTestamentMenu(btn) {
      if (menu.hidden || menu._anchor !== btn) openTestamentMenu(btn);
      else closeTestamentMenu();
    }
    testamentBtn.addEventListener("click", () => toggleTestamentMenu(testamentBtn));
    sheetBtn.addEventListener("click", () => toggleTestamentMenu(sheetBtn));
    testamentBtn.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      openTestamentMenu(testamentBtn);
    });
    sheetBtn.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      openTestamentMenu(sheetBtn);
    });
    more.addEventListener("click", () => {
      const open = sheet.hidden;
      setTestamentSheet(open);
      if (!open) closeTestamentMenu();
    });
    menu.addEventListener("click", (event) => {
      const item = event.target.closest(".search-testament-option");
      if (!item) return;
      event.preventDefault();
      chooseTestament(item.getAttribute("data-value"), menu._anchor === sheetBtn);
    });
    document.addEventListener("pointerdown", (event) => {
      if (menu.hidden) return;
      if (event.target.closest(".search-testament-menu, .search-testament-btn")) return;
      closeTestamentMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (menu.hidden) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        moveTestament(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter") {
        const active = menu.querySelector(".search-testament-option.is-active");
        if (!active) return;
        event.preventDefault();
        event.stopPropagation();
        chooseTestament(active.getAttribute("data-value"), menu._anchor === sheetBtn);
      }
    }, true);
    window.addEventListener("resize", () => placeTestamentMenu());
    document.body.appendChild(modal);
    backdrop.addEventListener("click", () => closeSearchModal());
    bindSheetSwipe(bar, results, panel);
    searchForm.addEventListener("submit", (event) => {
      const q = input.value.trim();
      event.preventDefault();
      if (!q) {
        close();
        return;
      }
      mirrorHeader(q);
      syncSearchQuery(q);
      submitJump(q);
    });
    input.addEventListener("keydown", (event) => {
      const items = optionItems();
      if (event.key === "ArrowDown") {
        if (list.hidden || !items.length) return;
        event.preventDefault();
        moveHighlight(1);
        return;
      }
      if (event.key === "ArrowUp") {
        if (list.hidden || !items.length) return;
        event.preventDefault();
        moveHighlight(-1);
        return;
      }
      if (event.key === "Enter") {
        const q = input.value.trim();
        const passage = selected >= 0 && passageHit(hits[selected]) ? hits[selected] : null;
        if (passage) {
          event.preventDefault();
          applyHit(passage);
          return;
        }
        if (hits.length && selected >= 0 && q === submittedQuery) {
          event.preventDefault();
          applyHit(hits[selected]);
        }
        return;
      }
      if (event.key === "Tab") {
        const passage = selected >= 0 && passageHit(hits[selected]) ? hits[selected] : null;
        if (!passage) return;
        event.preventDefault();
        applyHit(passage);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearchModal();
      }
    });
    input.addEventListener("input", () => {
      if (String(input.value || "").trim()) {
        hideTopicChips();
        hideHistory();
        suggest();
        return;
      }
      if (timer) clearTimeout(timer);
      suggestSeq += 1;
      seq += 1;
      close();
      loadTopicSuggestions();
    });
    topicChips.addEventListener("scroll", () => syncChipFades(topicChips), { passive: true });
    function submitChip(q) {
      input.value = q;
      mirrorHeader(q);
      syncSearchQuery(q);
      hideTopicChips();
      hideHistory();
      submitJump(q);
    }
    topicChips.addEventListener("click", (event) => {
      const chip = event.target.closest("button.search-suggest-chip");
      if (!chip) return;
      event.preventDefault();
      const q = String(chip.getAttribute("data-query") || "").trim();
      if (!q) return;
      submitChip(q);
    });
    historyChips.addEventListener("scroll", () => syncChipFades(historyChips), { passive: true });
    historyChips.addEventListener("click", (event) => {
      const chip = event.target.closest("button.search-suggest-chip");
      if (!chip) return;
      event.preventDefault();
      const q = String(chip.getAttribute("data-query") || "").trim();
      if (!q) return;
      submitChip(q);
    });
    list.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-index]");
      if (!btn) return;
      event.preventDefault();
      const index = Number(btn.dataset.index);
      if (!Number.isFinite(index) || !hits[index]) return;
      applyHit(hits[index]);
    });
    return modal;
  }

  function ensureSearchFab() {
    if (document.querySelector(".search-fab")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-fab";
    btn.setAttribute("aria-label", "Search scripture");
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M9 6V8H2V6H9M9 11V13H2V11H9M18 16V18H2V16H18M19.31 11.5C19.75 10.82 20 10 20 9.11C20 6.61 18 4.61 15.5 4.61S11 6.61 11 9.11 13 13.61 15.5 13.61C16.37 13.61 17.19 13.36 17.88 12.93L21 16L22.39 14.61L19.31 11.5M15.5 11.61C14.12 11.61 13 10.5 13 9.11S14.12 6.61 15.5 6.61 18 7.73 18 9.11 16.88 11.61 15.5 11.61Z"/></svg>';
    btn.addEventListener("click", () => focusVisibleJump());
    document.body.appendChild(btn);
  }

  function readSearchCache() {
    if (cachedSearch && cachedSearch.query) return cachedSearch;
    try {
      const raw = sessionStorage.getItem("margin-search-cache");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.query !== "string" || !Array.isArray(data.hits)) return null;
      cachedSearch = {
        query: data.query,
        hits: data.hits,
        testament: normalizeTestament(data.testament),
        scripture: Boolean(data.scripture),
      };
      return cachedSearch;
    } catch (_) {
      return null;
    }
  }

  function writeSearchCache(query, nextHits, scripture) {
    const packed = (nextHits || []).map((hit) => ({
      kind: hit && hit.kind ? String(hit.kind) : "scripture",
      label: String((hit && (hit.label || hit.insertText)) || ""),
      text: String((hit && hit.text) || ""),
      path: hit && hit.path ? String(hit.path) : "",
      insertText: hit && hit.insertText ? String(hit.insertText) : "",
      html: hit && hit.html ? String(hit.html) : "",
    }));
    cachedSearch = {
      query: String(query || ""),
      hits: packed,
      testament: normalizeTestament(searchTestament),
      scripture: Boolean(scripture),
    };
    try { sessionStorage.setItem("margin-search-cache", JSON.stringify(cachedSearch)); }
    catch (_) {}
    mirrorHeader(cachedSearch.query);
  }

  function clearSearchCache() {
    cachedSearch = null;
    submittedQuery = "";
    try { sessionStorage.removeItem("margin-search-cache"); } catch (_) {}
  }

  function modalIsOpen() {
    const modal = searchRoot();
    return Boolean(modal && !modal.hidden);
  }

  function optionItems() {
    const list = searchList();
    if (!list) return [];
    return [...list.querySelectorAll("li[role='option']")];
  }

  function syncActive() {
    const list = searchList();
    const input = searchInput();
    if (!list || !input) return;
    const items = optionItems();
    const active = items[selected];
    if (active) {
      input.setAttribute("aria-activedescendant", active.id);
      const listRect = list.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      if (itemRect.top < listRect.top) list.scrollTop -= listRect.top - itemRect.top;
      else if (itemRect.bottom > listRect.bottom) list.scrollTop += itemRect.bottom - listRect.bottom;
    } else input.removeAttribute("aria-activedescendant");
  }

  function close() {
    const list = searchList();
    const input = searchInput();
    if (list) {
      list.hidden = true;
      list.innerHTML = "";
      list.removeAttribute("aria-busy");
    }
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    selected = -1;
    hits = [];
    if (list) list.classList.remove("is-passage");
    syncTopicChips();
  }

  function showSearchSkeletons() {
    hits = [];
    selected = -1;
    openSearchModal();
    const list = searchList();
    const input = searchInput();
    if (!list || !input) return;
    list.hidden = false;
    list.classList.remove("is-passage");
    input.setAttribute("aria-expanded", "true");
    list.setAttribute("aria-busy", "true");
    input.removeAttribute("aria-activedescendant");
    let rows = "";
    for (let i = 0; i < 4; i++) {
      rows +=
        '<li class="suggest-skeleton" aria-hidden="true">' +
        '<span class="suggest-skeleton-ref"></span>' +
        '<span class="suggest-skeleton-text"></span>' +
        "</li>";
    }
    list.innerHTML = rows;
    syncTopicChips();
  }

  function showSearchUnavailable() {
    hits = [];
    selected = -1;
    openSearchModal();
    const list = searchList();
    const input = searchInput();
    if (!list || !input) return;
    list.hidden = false;
    list.classList.remove("is-passage");
    list.removeAttribute("aria-busy");
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
    list.innerHTML = '<li class="search-unavailable" role="status">Search unavailable</li>';
    syncTopicChips();
  }

  ${searchHighlightSource()}
  function render(state) {
    openSearchModal();
    const list = searchList();
    const input = searchInput();
    if (!list || !input) return;
    list.removeAttribute("aria-busy");
    hits = state.hits || [];
    const rawHint = state.hint ? String(state.hint) : "";
    const hintText = rawHint.indexOf("CC BY") === -1 ? rawHint : "";
    const open = hits.length > 0 || Boolean(hintText);
    selected = open && hits.length ? 0 : -1;
    list.hidden = !open;
    input.setAttribute("aria-expanded", open ? "true" : "false");
    const hint = hintText
      ? '<li class="suggest-hint" role="note">' + escape(hintText) + "</li>"
      : "";
    const passageList = open && !hits.some((hit) => hit && hit.kind === "scripture") &&
      (hits.some(passageHit) || Boolean(hintText));
    list.classList.toggle("is-passage", passageList);
    const options = hits
      .map((hit, index) => {
        const id = "search-result-" + index;
        const sel = index === selected;
        const shown = hit.html ? hit.html : highlightQuery(hit.text, submittedQuery);
        const body = hit.kind === "scripture"
          ? '<span class="search-result-ref">' + escape(hit.label) + "</span>" +
            (hit.text || hit.html ? '<span class="search-result-text">' + shown + "</span>" : "")
          : passageHit(hit)
            ? '<span class="search-result-passage">' + escape(hit.label) + "</span>"
            : '<span class="search-result-ref">' + escape(hit.label) + "</span>";
        return (
          '<li id="' + id + '" role="option" aria-selected="' + (sel ? "true" : "false") + '">' +
          '<button type="button" class="search-result' + (sel ? " is-selected" : "") + '" data-index="' + index + '">' +
          body +
          "</button></li>"
        );
      })
      .join("");
    list.innerHTML = options + hint;
    syncActive();
    syncTopicChips();
  }

  function passageHit(hit) {
    const kind = hit && hit.kind;
    return kind === "book" || kind === "chapter" || kind === "verse";
  }

  function showingPassageHelpers() {
    if (hits.some(passageHit)) return true;
    const list = searchList();
    if (!list || list.hidden || hits.some((hit) => hit && hit.kind === "scripture")) return false;
    return list.classList.contains("is-passage");
  }

  function insertTextFor(hit) {
    const text = String(hit?.insertText || hit?.label || "");
    if (hit?.kind === "book" && text && !text.endsWith(" ")) return text + " ";
    return text;
  }

  function sameEntry(current, next) {
    return current.trim().toLowerCase() === String(next || "").trim().toLowerCase();
  }

  function scriptureHits(data) {
    const evidence = Array.isArray(data && data.evidence) ? data.evidence : [];
    const next = [];
    for (const item of evidence) {
      const path = marginPathFromRouteHref(item && item.href);
      if (!path || !keepScripture(path)) continue;
      const text = String((item && item.text) || "");
      next.push({
        kind: "scripture",
        label: String((item && item.displayRef) || path.slice(1)),
        text,
        html: highlightFromHiddenArrow(item),
        path,
      });
    }
    return next;
  }

  function readRecentSearches() {
    try {
      const raw = localStorage.getItem("margin-recent-searches");
      const data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      const out = [];
      const seen = {};
      for (const item of data) {
        const text = String(item || "").trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen[key]) continue;
        seen[key] = 1;
        out.push(text);
        if (out.length >= 10) break;
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  function rememberRecentSearch(query) {
    const next = String(query || "").trim();
    if (!next) return;
    const key = next.toLowerCase();
    const prev = readRecentSearches().filter((item) => item.toLowerCase() !== key);
    const packed = [next].concat(prev).slice(0, 10);
    try { localStorage.setItem("margin-recent-searches", JSON.stringify(packed)); }
    catch (_) {}
  }

  function cleanTopics(raw) {
    const out = [];
    const list = Array.isArray(raw) ? raw : [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const label = String(item.label || "").trim();
      const query = String(item.query || "").trim();
      if (!label || !query) continue;
      out.push({ label: label, query: query });
      if (out.length >= 5) break;
    }
    return out;
  }

  function readTopicCache(recent) {
    try {
      const raw = sessionStorage.getItem("margin-suggest-cache");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.key !== JSON.stringify(recent) || !Array.isArray(data.topics)) return null;
      const topics = cleanTopics(data.topics);
      return topics.length ? topics : null;
    } catch (_) {
      return null;
    }
  }

  function writeTopicCache(recent, topics) {
    try {
      sessionStorage.setItem("margin-suggest-cache", JSON.stringify({ key: JSON.stringify(recent), topics: topics }));
    } catch (_) {}
  }

  function topicRow() {
    const modal = searchRoot();
    return modal ? modal.querySelector(".search-suggest") : null;
  }

  function resultsOpen() {
    const list = searchList();
    return Boolean(list && !list.hidden);
  }

  function hideTopicChips() {
    const row = topicRow();
    if (row) row.hidden = true;
  }

  function historyRow() {
    const modal = searchRoot();
    return modal ? modal.querySelector(".search-history") : null;
  }

  function hideHistory() {
    const row = historyRow();
    if (row) row.hidden = true;
  }

  function canOfferTopics() {
    const input = searchInput();
    return Boolean(modalIsOpen() && input && !String(input.value || "").trim() && !resultsOpen());
  }

  function paintTopicChips(topics) {
    const row = topicRow();
    const chips = row && row.querySelector(".search-suggest-chips");
    if (!row || !chips || !canOfferTopics() || !topics.length) {
      hideTopicChips();
      return;
    }
    chips.replaceChildren();
    for (const topic of topics) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-suggest-chip";
      btn.textContent = topic.label;
      btn.setAttribute("data-query", topic.query);
      chips.appendChild(btn);
    }
    row.hidden = false;
    requestAnimationFrame(() => syncChipFades(chips));
  }

  function paintHistory() {
    const row = historyRow();
    const chips = row && row.querySelector(".search-history-chips");
    if (!row || !chips || !canOfferTopics()) {
      hideHistory();
      return;
    }
    const recent = readRecentSearches();
    if (!recent.length) {
      hideHistory();
      return;
    }
    chips.replaceChildren();
    for (const query of recent) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-suggest-chip";
      btn.textContent = query;
      btn.setAttribute("data-query", query);
      chips.appendChild(btn);
    }
    row.hidden = false;
    requestAnimationFrame(() => syncChipFades(chips));
  }

  function syncChipFades(chips) {
    const row = chips || document.querySelector(".search-suggest-chips");
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    row.classList.toggle("is-fade-left", row.scrollLeft > 2);
    row.classList.toggle("is-fade-right", max - row.scrollLeft > 2);
  }

  function syncTopicChips() {
    if (!canOfferTopics()) {
      hideTopicChips();
      hideHistory();
      return;
    }
    paintHistory();
    paintTopicChips(suggestTopics);
  }

  async function loadTopicSuggestions() {
    if (!canOfferTopics()) {
      hideTopicChips();
      hideHistory();
      return;
    }
    paintHistory();
    const recent = readRecentSearches();
    if (recent.length < 2) {
      hideTopicChips();
      return;
    }
    const cached = readTopicCache(recent);
    if (cached) {
      suggestTopics = cached;
      suggestAttempted = true;
      paintTopicChips(cached);
      return;
    }
    if (suggestAttempted) return;
    suggestAttempted = true;
    const token = ++suggestToken;
    try {
      const res = await fetch("/api/ha-suggest", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ recent: recent }),
      });
      if (token !== suggestToken) return;
      if (!res.ok) {
        hideTopicChips();
        return;
      }
      const data = await res.json();
      if (token !== suggestToken) return;
      const topics = cleanTopics(data && data.topics);
      if (!topics.length || !canOfferTopics()) {
        hideTopicChips();
        return;
      }
      suggestTopics = topics;
      writeTopicCache(recent, topics);
      paintTopicChips(topics);
    } catch (_) {
      if (token !== suggestToken) return;
      hideTopicChips();
    }
  }

  async function searchScripture(q, my) {
    try {
      const res = await fetch("/api/ha-search", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (my !== seq) return;
      if (!res.ok) {
        writeSearchCache(q, [], true);
        if (modalIsOpen()) showSearchUnavailable();
        return;
      }
      const data = await res.json();
      if (my !== seq) return;
      const next = scriptureHits(data);
      if (!next.length) {
        writeSearchCache(q, [], true);
        if (modalIsOpen()) close();
        return;
      }
      writeSearchCache(q, next, true);
      if (modalIsOpen()) render({ hits: next });
    } catch (_) {
      if (my !== seq) return;
      writeSearchCache(q, [], true);
      if (modalIsOpen()) showSearchUnavailable();
    }
  }

  async function suggestNow() {
    const input = searchInput();
    const q = input ? input.value : "";
    const my = ++suggestSeq;
    const searchSeq = seq;
    if (!String(q).trim()) {
      if (my === suggestSeq) close();
      return;
    }
    try {
      const res = await fetch("/api/jump-suggest?q=" + encodeURIComponent(q), {
        headers: { accept: "application/json" },
      });
      if (!res.ok || my !== suggestSeq || searchSeq !== seq) return;
      const data = await res.json();
      if (my !== suggestSeq || searchSeq !== seq || !modalIsOpen()) return;
      const typed = searchInput();
      if (!typed || String(typed.value || "") !== String(q)) return;
      const nextHits = Array.isArray(data.hits) ? data.hits : [];
      const hint = data.hint ? String(data.hint) : "";
      if (nextHits.length || hint) {
        render(data);
        return;
      }
      if (showingPassageHelpers()) close();
    } catch (_) {
      /* ignore transient network blips */
    }
  }

  async function submitJump(q) {
    if (timer) clearTimeout(timer);
    suggestSeq += 1;
    const my = ++seq;
    let data = null;
    try {
      const res = await fetch("/api/jump-suggest?q=" + encodeURIComponent(q), {
        headers: { accept: "application/json" },
      });
      if (res.ok) data = await res.json();
    } catch (_) {
      data = null;
    }
    if (my !== seq) return;
    if (!data || data.canGo) {
      const jumpUrl = "/jump?q=" + encodeURIComponent(q);
      if (searchState) {
        searchState = false;
        location.replace(jumpUrl);
      } else location.assign(jumpUrl);
      return;
    }
    if ((data.hits && data.hits.length) || data.hint) {
      scriptureSearchActive = false;
      submittedQuery = q;
      writeSearchCache(q, data.hits || []);
      render(data);
      return;
    }
    scriptureSearchActive = true;
    submittedQuery = q;
    rememberRecentSearch(q);
    showSearchSkeletons();
    searchScripture(q, my);
  }

  function suggest() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(suggestNow, 40);
  }

  function moveHighlight(delta) {
    const items = optionItems();
    if (!items.length) return;
    selected = (selected + delta + items.length) % items.length;
    items.forEach((item, i) => {
      const on = i === selected;
      item.setAttribute("aria-selected", on ? "true" : "false");
      const btn = item.querySelector("button");
      if (btn) btn.classList.toggle("is-selected", on);
    });
    syncActive();
  }

  async function canGo(value) {
    try {
      const res = await fetch("/api/jump-suggest?q=" + encodeURIComponent(value), {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.canGo);
    } catch (_) {
      return false;
    }
  }

  function goToInput() {
    const input = searchInput();
    const q = input ? input.value.trim() : "";
    if (!q || !input || !input.form) return;
    input.form.requestSubmit();
  }

  async function applyHit(hit) {
    if (!hit) return;
    if (hit.kind === "scripture" && hit.path) {
      const input = searchInput();
      if (input) input.blur();
      if (searchState) {
        searchState = false;
        location.replace(hit.path);
      } else location.assign(hit.path);
      return;
    }
    const input = searchInput();
    if (!input) return;
    const next = insertTextFor(hit);
    const current = input.value;
    if (sameEntry(current, next) && (await canGo(current))) {
      goToInput();
      return;
    }
    input.value = next;
    mirrorHeader(next);
    input.focus();
    input.setSelectionRange(next.length, next.length);
    suggestNow();
  }

  function bindJump(form) {
    if (!form || form.dataset.jumpBound === "1") return;
    form.dataset.jumpBound = "1";
    const input = form.querySelector('input[type="search"]');
    const list = form.querySelector("ul.suggest");
    const clearBtn = form.querySelector("button.jump-clear");
    if (!input || !list) return;

    // Unique ids so aria-controls stays valid when multiple forms exist (reader + SPA inbox).
    const uid = "jump-" + Math.random().toString(36).slice(2, 9);
    input.id = uid + "-q";
    list.id = uid + "-suggest";
    input.setAttribute("aria-controls", list.id);
    const label = form.querySelector("label.sr-only");
    if (label) label.setAttribute("for", input.id);

    function syncClear() {
      if (!clearBtn) return;
      clearBtn.hidden = !String(input.value || "").length;
    }

    input.addEventListener("input", () => {
      syncClear();
    });
    input.addEventListener("focus", () => {
      openFromHeader(input);
    });
    input.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      openFromHeader(input);
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (event) => event.preventDefault());
      clearBtn.addEventListener("click", () => {
        input.value = "";
        syncClear();
        const modalInput = searchInput();
        if (modalInput) modalInput.value = "";
        clearSearchCache();
        close();
        closeSearchModal();
      });
    }
    syncClear();

    form.addEventListener("submit", (event) => {
      const q = input.value.trim();
      event.preventDefault();
      syncSearchQuery(q);
      if (!q) return;
      ensureSearchModal();
      const modalInput = searchInput();
      if (modalInput) modalInput.value = q;
      openSearchModal();
      submitJump(q);
    });
  }

  function syncSearchQuery(q) {
    let url;
    try { url = new URL(location.href); } catch (_) { return; }
    const next = String(q || "").trim();
    if (next) url.searchParams.set("q", next);
    else url.searchParams.delete("q");
    const nextHref = url.pathname + url.search + url.hash;
    const current = location.pathname + location.search + location.hash;
    if (nextHref === current) return;
    history.replaceState(history.state, "", nextHref);
  }

  function bootSearchQuery() {
    syncTestamentFromStorage();
    let q = "";
    try { q = new URL(location.href).searchParams.get("q") || ""; } catch (_) { return; }
    q = q.trim();
    const cache = readSearchCache();
    if (!q && cache && cache.query) {
      mirrorHeader(cache.query);
      return;
    }
    if (!q) return;
    const forms = [...document.querySelectorAll("form.jump")];
    const visible = forms.find((f) => f.offsetParent !== null) || forms[0];
    if (!visible || visible.dataset.jumpBound !== "1") return;
    const input = visible.querySelector('input[type="search"]');
    if (!input) return;
    input.value = q;
    const clearBtn = visible.querySelector("button.jump-clear");
    if (clearBtn) clearBtn.hidden = false;
    if (cache && cache.query === q && normalizeTestament(cache.testament) === searchTestament) return;
    if (typeof visible.requestSubmit === "function") visible.requestSubmit();
  }

  function bindAll() {
    document.querySelectorAll("form.jump").forEach(bindJump);
  }

  function focusVisibleJump() {
    const forms = [...document.querySelectorAll("form.jump")];
    const visible = forms.find((f) => f.offsetParent !== null) || forms[0];
    const header = visible && visible.querySelector('input[type="search"]');
    ensureSearchModal();
    const input = searchInput();
    if (!input) return false;
    if (!revealCachedSearch()) {
      if (header && String(header.value || "").length) input.value = header.value;
      openSearchModal();
    }
    input.focus();
    input.select();
    return true;
  }

  function isSearchChord(event) {
    if (event.repeat) return false;
    const key = event.key || "";
    if (key !== "k" && key !== "K" && event.code !== "KeyK") return false;
    if (event.altKey || event.shiftKey) return false;
    const platform = (navigator.platform || "") + " " + (navigator.userAgent || "");
    const mac = /Mac|iPhone|iPad|iPod/i.test(platform);
    if (mac) return Boolean(event.metaKey) && !event.ctrlKey;
    return Boolean(event.ctrlKey) && !event.metaKey;
  }

  if (!window.__marginJumpShortcutBound) {
    window.__marginJumpShortcutBound = true;
    document.addEventListener("keydown", (event) => {
      if (!isSearchChord(event)) return;
      if (!focusVisibleJump()) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "/" && event.key !== "j") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const t = event.target;
      const tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (!focusVisibleJump()) return;
      event.preventDefault();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (closeTestamentMenu()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const modal = document.querySelector(".search-modal");
      if (!modal || modal.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      closeSearchModal();
    }, true);
    window.addEventListener("popstate", () => {
      const modal = document.querySelector(".search-modal");
      const sheetOpen = Boolean(modal && !modal.hidden);
      const shouldRestore = restoreQueryOnPop || sheetOpen;
      restoreQueryOnPop = false;
      if (sheetOpen) {
        closeViaPop = true;
        closeSearchModal();
        closeViaPop = false;
      }
      if (!shouldRestore) return;
      const cache = readSearchCache();
      if (cache && cache.query) syncSearchQuery(cache.query);
    });
  }

  window.__marginBindJump = bindAll;
  bindAll();
  ensureSearchFab();
  if (!window.__marginSearchQueryBoot) {
    window.__marginSearchQueryBoot = true;
    bootSearchQuery();
  }
})();`;
}
