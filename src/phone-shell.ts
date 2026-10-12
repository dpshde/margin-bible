/**
 * Phone tab bar (max-width 767). Bookmarks and Topics stay in the notes
 * document and paint on pointerdown, before a hash change can show the other
 * list. The chapter the reader already rendered stays mounted; the other
 * surface is a preloaded iframe that is shown and hidden, not navigated in.
 */

export type PhoneCollectionTab = "notes" | "bookmarks" | "groups";

/** Hash wins over `?vg=`, so #bookmarks never resolves as Topics. */
export function phoneCollectionTabFromLocation(hash: string, search: string): PhoneCollectionTab {
  const name = hash.replace(/^#/, "");
  if (name === "bookmarks" || name === "groups") return name;
  const query = search.startsWith("?") ? search.slice(1) : search;
  const vg = new URLSearchParams(query).get("vg");
  if (vg === "topics" || vg === "set" || vg === "folder") return "groups";
  return "notes";
}

export function phoneCollectionHref(tab: PhoneCollectionTab): string {
  return tab === "notes" ? "/notes" : `/notes#${tab}`;
}

/** Runs before the notes header so the first paint already has data-phone-tab. */
export function phoneTabBootScript(): string {
  return `<script>
(function () {
  try {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    var hash = String(location.hash || "").replace(/^#/, "");
    var tab = hash === "bookmarks" || hash === "groups" ? hash : "";
    if (!tab) {
      var vg = new URLSearchParams(location.search).get("vg");
      if (vg === "topics" || vg === "set" || vg === "folder") tab = "groups";
    }
    if (!tab) tab = "notes";
    document.documentElement.setAttribute("data-phone-tab", tab);
  } catch (err) {}
})();
</script>`;
}

/** Opens the matching list once those nodes exist, still before first paint. */
export function phoneTabPaintScript(): string {
  return `<script>
(function () {
  try {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    var tab = document.documentElement.getAttribute("data-phone-tab") || "notes";
    var bookmarks = document.getElementById("bookmarks-view");
    var groups = document.getElementById("verse-groups-view");
    if (bookmarks) bookmarks.open = tab === "bookmarks";
    if (groups) groups.open = tab === "groups";
    var titles = { notes: "Notes", bookmarks: "Bookmarks", groups: "Topics" };
    var title = document.getElementById("chapter-grid-title");
    if (title && titles[tab]) title.textContent = titles[tab];
  } catch (err) {}
})();
</script>`;
}

/**
 * Keeps the other phone surface loaded. Showing it toggles opacity; the
 * reader nodes (this document, or the iframe document) are not removed.
 */
export function phoneShellScript(): string {
  return `(() => {
  var mq = window.matchMedia("(max-width: 767px)");
  function phone() { return mq.matches; }
  var embedded = window.parent !== window;
  if (embedded) document.documentElement.setAttribute("data-phone-embed", "1");

  function readerHref() {
    var link = document.querySelector("[data-reader-link]");
    var href = link && link.getAttribute("href");
    if (href) return href;
    var reader = document.getElementById("reader");
    if (reader) {
      var slug = reader.getAttribute("data-passage-slug") || reader.getAttribute("data-chapter-slug") || "jhn.1";
      return "/" + String(slug).replace(/^\\/+/, "");
    }
    return "/jhn.1";
  }

  function notesDocument() {
    return Boolean(document.querySelector(".notes-main"));
  }

  function frameEl() {
    return document.getElementById("phone-kept-surface");
  }

  function markParentTab(name) {
    var tabs = document.querySelectorAll(".phone-tab");
    for (var i = 0; i < tabs.length; i++) {
      var tabName = tabs[i].getAttribute("data-phone-tab");
      if (tabName === name) tabs[i].setAttribute("aria-current", "page");
      else tabs[i].removeAttribute("aria-current");
    }
  }

  function park(frame) {
    if (!frame) return;
    frame.classList.add("is-parked");
    frame.classList.remove("is-live");
    frame.setAttribute("aria-hidden", "true");
  }

  function reveal(frame) {
    frame.classList.remove("is-parked");
    frame.classList.add("is-live");
    frame.removeAttribute("aria-hidden");
  }

  function cover(on) {
    document.documentElement.classList.toggle("phone-surface-covered", Boolean(on));
  }

  function applyLocal(tab) {
    if (window.__marginApplyPhoneTab) window.__marginApplyPhoneTab(tab);
  }

  function frameReady(frame) {
    try {
      var doc = frame.contentDocument;
      if (!doc || doc.readyState === "loading" || doc.location.href === "about:blank") return false;
      if (notesDocument()) return Boolean(doc.getElementById("reader"));
      return Boolean(doc.querySelector(".notes-main")) && typeof frame.contentWindow.__marginApplyPhoneTab === "function";
    } catch (err) {
      return false;
    }
  }

  function ensureFrame() {
    if (!phone() || embedded) return null;
    var existing = frameEl();
    if (existing) return existing;
    var frame = document.createElement("iframe");
    frame.id = "phone-kept-surface";
    frame.className = "phone-kept-surface is-parked";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", notesDocument() ? "Scripture" : "Notes");
    frame.loading = "eager";
    var src = notesDocument() ? readerHref() : "/notes";
    try {
      var url = new URL(src, location.origin);
      url.searchParams.set("phone_embed", "1");
      frame.src = url.pathname + url.search + url.hash;
    } catch (err) {
      frame.src = src;
    }
    document.body.appendChild(frame);
    frame.addEventListener("load", onFrameLoad);
    return frame;
  }

  var pendingTab = "";

  function fallbackNavigate(tab) {
    if (tab === "scripture") location.href = readerHref();
    else location.href = tab === "notes" ? "/notes" : "/notes#" + tab;
  }

  function showReader() {
    if (!notesDocument()) {
      park(frameEl());
      cover(false);
      markParentTab("scripture");
      try { performance.mark("margin-phone-reader"); } catch (err) {}
      return;
    }
    var frame = ensureFrame();
    if (!frame || !frameReady(frame)) {
      pendingTab = "scripture";
      return;
    }
    pendingTab = "";
    reveal(frame);
    cover(true);
    markParentTab("scripture");
    try { performance.mark("margin-phone-reader"); } catch (err) {}
  }

  function showCollection(tab) {
    if (notesDocument()) {
      applyLocal(tab);
      park(frameEl());
      cover(false);
      markParentTab(tab);
      try { performance.mark("margin-phone-tab"); } catch (err) {}
      return;
    }
    var frame = ensureFrame();
    if (!frame || !frameReady(frame)) {
      pendingTab = tab;
      return;
    }
    pendingTab = "";
    /* paint tab before reveal */
    frame.contentWindow.__marginApplyPhoneTab(tab);
    /* reveal kept surface */
    reveal(frame);
    cover(true);
    markParentTab(tab);
    try { performance.mark("margin-phone-tab"); } catch (err) {}
  }

  function showTab(name) {
    if (name === "scripture") showReader();
    else if (name === "notes" || name === "bookmarks" || name === "groups") showCollection(name);
  }

  function onFrameLoad() {
    var frame = frameEl();
    if (!frame || !pendingTab) return;
    var tab = pendingTab;
    if (frameReady(frame)) {
      pendingTab = "";
      showTab(tab);
      return;
    }
    try {
      var doc = frame.contentDocument;
      if (doc && doc.readyState === "complete" && doc.location.href !== "about:blank") {
        pendingTab = "";
        fallbackNavigate(tab);
      }
    } catch (err) {}
  }

  function tabLink(event) {
    var node = event.target;
    if (!node || !node.closest) return null;
    return node.closest("a.phone-tab");
  }

  function ignoredClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button;
  }

  document.addEventListener("pointerdown", function (event) {
    if (!phone() || embedded || ignoredClick(event)) return;
    var tab = tabLink(event);
    if (!tab) return;
    var name = tab.getAttribute("data-phone-tab");
    if (!name) return;
    showTab(name);
  }, true);

  document.addEventListener("click", function (event) {
    if (!phone() || ignoredClick(event)) return;
    var tab = tabLink(event);
    if (!tab) return;
    var name = tab.getAttribute("data-phone-tab");
    if (!name) return;
    event.preventDefault();
    if (embedded) {
      event.stopPropagation();
      if (name === "scripture" && window.parent.__marginPhoneShowReader) window.parent.__marginPhoneShowReader();
      else if (window.parent.__marginPhoneShowNotes) window.parent.__marginPhoneShowNotes(name);
      return;
    }
    showTab(name);
  }, true);

  window.__marginPhoneShowReader = function () {
    if (phone()) showReader();
  };
  window.__marginPhoneShowNotes = function (tab) {
    if (phone()) showCollection(tab || "notes");
  };

  if (!embedded && phone()) ensureFrame();

  if (mq.addEventListener) mq.addEventListener("change", function () {
    if (phone()) {
      ensureFrame();
      return;
    }
    cover(false);
    var frame = frameEl();
    if (frame) frame.remove();
  });
})();`;
}
