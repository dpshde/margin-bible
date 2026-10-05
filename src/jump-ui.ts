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

/** Browser jump combobox (string). Idempotent — safe to call after SPA injects a new form.jump. */
export function jumpScript(): string {
  return `(() => {
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
    document.documentElement.style.setProperty("--keyboard-inset", covered + "px");
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

    let hits = [];
    let selected = -1;
    let timer = null;
    let seq = 0;

    function syncClear() {
      if (!clearBtn) return;
      clearBtn.hidden = !String(input.value || "").length;
    }

    function optionItems() {
      return [...list.querySelectorAll("li[role='option']")];
    }

    function syncActive() {
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
      list.hidden = true;
      list.innerHTML = "";
      form.classList.remove("is-open");
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      selected = -1;
      hits = [];
    }

    function render(state) {
      hits = state.hits || [];
      const open = hits.length > 0 || Boolean(state.hint);
      selected = open && hits.length ? 0 : -1;
      list.hidden = !open;
      form.classList.toggle("is-open", open);
      input.setAttribute("aria-expanded", open ? "true" : "false");
      const hint = state.hint
        ? '<li class="suggest-hint" role="note">' + escape(state.hint) + "</li>"
        : "";
      const options = hits
        .map((hit, index) => {
          const id = uid + "-opt-" + index;
          const sel = index === selected;
          const body = hit.kind === "scripture"
            ? '<span class="suggest-ref">' + escape(hit.label) + "</span>" +
              (hit.text ? '<span class="suggest-text">' + escape(hit.text) + "</span>" : "")
            : escape(hit.label);
          const klass = hit.kind === "scripture" ? ' class="suggest-scripture"' : "";
          return (
            '<li id="' +
            id +
            '" role="option" aria-selected="' +
            (sel ? "true" : "false") +
            '"><button type="button" data-index="' +
            index +
            '"' +
            klass +
            ">" +
            body +
            "</button></li>"
          );
        })
        .join("");
      list.innerHTML = options + hint;
      syncActive();
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
        if (!path) continue;
        next.push({
          kind: "scripture",
          label: String((item && item.displayRef) || path.slice(1)),
          text: String((item && item.text) || ""),
          path,
        });
      }
      return next;
    }

    function attributionHint(data) {
      const lines = Array.isArray(data && data.attribution)
        ? data.attribution.filter((line) => typeof line === "string" && line.trim())
        : [];
      return lines.length ? lines.join(" ") : null;
    }

    async function searchScripture(q, my) {
      try {
        const res = await fetch("/api/ha-search", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ query: q }),
        });
        if (!res.ok || my !== seq) return;
        const data = await res.json();
        if (my !== seq) return;
        const next = scriptureHits(data);
        if (!next.length) {
          close();
          return;
        }
        render({ hits: next, hint: attributionHint(data) });
      } catch (_) {
        if (my === seq) close();
      }
    }

    async function suggestNow() {
      const q = input.value;
      const my = ++seq;
      if (!String(q).trim()) {
        close();
        return;
      }
      try {
        const res = await fetch("/api/jump-suggest?q=" + encodeURIComponent(q), {
          headers: { accept: "application/json" },
        });
        if (!res.ok || my !== seq) return;
        const data = await res.json();
        if (my !== seq) return;
        render(data);
      } catch (_) {
        /* ignore transient network blips */
      }
    }

    async function submitJump(q) {
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
        location.assign("/jump?q=" + encodeURIComponent(q));
        return;
      }
      if ((data.hits && data.hits.length) || data.hint) {
        render(data);
        return;
      }
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
      items.forEach((item, i) => item.setAttribute("aria-selected", i === selected ? "true" : "false"));
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
      const q = input.value.trim();
      if (!q) return;
      form.requestSubmit();
    }

    async function applyHit(hit) {
      if (!hit) return;
      if (hit.kind === "scripture" && hit.path) {
        input.blur();
        location.assign(hit.path);
        return;
      }
      const next = insertTextFor(hit);
      const current = input.value;
      if (sameEntry(current, next) && (await canGo(current))) {
        goToInput();
        return;
      }
      input.value = next;
      syncClear();
      input.focus();
      input.setSelectionRange(next.length, next.length);
      suggestNow();
    }

    input.addEventListener("input", () => {
      syncClear();
      suggest();
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
        if (selected >= 0 && items.length) {
          event.preventDefault();
          applyHit(hits[selected]);
        }
        return;
      }
      if (event.key === "Tab" && selected >= 0 && items.length) {
        event.preventDefault();
        applyHit(hits[selected]);
        return;
      }
      if (event.key === "Escape") close();
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", (event) => event.preventDefault());
      clearBtn.addEventListener("click", () => {
        input.value = "";
        syncClear();
        close();
        input.focus();
      });
    }
    syncClear();

    list.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-index]");
      if (!btn) return;
      event.preventDefault();
      const index = Number(btn.dataset.index);
      if (!Number.isFinite(index) || !hits[index]) return;
      applyHit(hits[index]);
    });

    form.addEventListener("submit", (event) => {
      const q = input.value.trim();
      event.preventDefault();
      if (!q) return;
      submitJump(q);
    });
  }

  function bindAll() {
    document.querySelectorAll("form.jump").forEach(bindJump);
  }

  function focusVisibleJump() {
    const forms = [...document.querySelectorAll("form.jump")];
    const visible = forms.find((f) => f.offsetParent !== null) || forms[0];
    const input = visible && visible.querySelector('input[type="search"]');
    if (!input) return false;
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
  }

  window.__marginBindJump = bindAll;
  bindAll();
})();`;
}
