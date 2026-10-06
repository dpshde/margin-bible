/**
 * Inbox surface for verse webs. Same chrome as Bookmarks.
 * Each web is a bookmark row that opens onto its member chips.
 */
import { escapeHtml } from "./html";
import type { VerseGroupMember, VerseGroupView } from "./verse-groups";
import { hrefForXref } from "./xref";

export function verseGroupsViewHtml(groups: readonly VerseGroupView[]): string {
  const body = groups.length
    ? `<ul class="note-list">${groups.map((group) => `<li>${verseGroupCardHtml(group)}</li>`).join("")}</ul>`
    : `<p class="empty">No verse groups yet — link 2+ notes to a hub</p>`;
  return `<details class="bookmarks-view" id="verse-groups-view"><summary><span class="bookmarks-summary-label">${verseGroupsIcon()}<span>Verse groups</span></span></summary><div class="bookmarks-panel" id="verse-groups-panel">${body}</div></details>${attachDialogHtml()}`;
}

export function verseGroupCardHtml(group: VerseGroupView, status = ""): string {
  const field = group.hub.replaceAll(".", "-");
  const star = group.star || "";
  const chips = group.members.map((member, index) => verseChipHtml(member, member.slug === star, member.order ?? index)).join("");
  const saved = group.title.trim();
  const rowTitle = saved || group.hubLabel;
  const excerpt = saved && saved !== group.hubLabel ? group.hubLabel : "";
  return `<details class="verse-group" data-hub="${escapeHtml(group.hub)}" data-hub-label="${escapeHtml(group.hubLabel)}" data-star="${escapeHtml(star)}" data-sample="${group.sample ? "1" : "0"}" data-seed="${group.seed ? "1" : "0"}">
  <summary class="note-row"><span class="note-row-title">${escapeHtml(rowTitle)}</span>${excerpt ? `<span class="note-row-excerpt">${escapeHtml(excerpt)}</span>` : ""}<span class="verse-group-hub">${escapeHtml(group.hubLabel)}</span></summary>
  <form class="verse-group-form">
    <div class="verse-group-fields">
      <div class="verse-group-title-field">
        <input id="vg-title-${field}" name="title" value="${escapeHtml(saved)}" placeholder="Title" maxlength="120" autocomplete="off" aria-label="Title">
        <button type="button" class="verse-group-topic" data-vg-topic aria-label="Suggest a title" title="Suggest a title">${iconTopic()}</button>
      </div>
      <textarea id="vg-description-${field}" class="verse-group-description" name="description" rows="1" maxlength="2000" placeholder="Description" aria-label="Description">${escapeHtml(group.description)}</textarea>
    </div>
    <div class="verse-group-verses">
      <ul class="att-board">${chips}</ul>
      <button type="button" class="tray-attach" data-vg-attach aria-label="Attach a link or passage" title="Attach">${iconPaperclip()}</button>
    </div>
    <p class="verse-group-status" role="status">${escapeHtml(status)}</p>
  </form>
</details>`;
}

export function verseGroupsScript(): string {
  return `(() => {
  var view = document.getElementById("verse-groups-view");
  var panel = document.getElementById("verse-groups-panel");
  var dialog = document.getElementById("vg-att-drop");
  if (!view || !panel) return;
  var OPEN_KEY = "margin_verse_groups_open";
  var FLASH_KEY = "margin_verse_groups_flash";
  var active = null;
  var hits = [];
  var selected = -1;
  var suggestTimer = null;
  var suggestSeq = 0;

  function setOpen(open) {
    view.open = Boolean(open);
  }

  if (location.hash === "#verse-groups") setOpen(true);
  try {
    if (sessionStorage.getItem(OPEN_KEY) === "1") {
      sessionStorage.removeItem(OPEN_KEY);
      setOpen(true);
    }
    var raw = sessionStorage.getItem(FLASH_KEY);
    if (raw) {
      sessionStorage.removeItem(FLASH_KEY);
      var flash = JSON.parse(raw);
      var cards = panel.querySelectorAll(".verse-group");
      var card = null;
      for (var i = 0; i < cards.length; i += 1) {
        if (cards[i].getAttribute("data-hub") === flash.hub) card = cards[i];
      }
      if (card) card.open = true;
      var status = card && card.querySelector(".verse-group-status");
      if (status && flash.message) status.textContent = flash.message;
    }
  } catch (err) {}

  function inputEl() { return document.getElementById("vg-att-drop-input"); }
  function suggestEl() { return document.getElementById("vg-att-drop-suggest"); }
  function fieldEl() { return document.querySelector("#vg-att-drop .att-drop-field"); }
  function statusEl() { return document.getElementById("vg-att-drop-status"); }
  function zoneEl() { return document.getElementById("vg-att-drop-zone"); }

  function closeSuggest() {
    var suggest = suggestEl();
    var input = inputEl();
    if (suggest) { suggest.hidden = true; suggest.innerHTML = ""; }
    fieldEl()?.classList.remove("is-open");
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    selected = -1;
    hits = [];
  }

  function optionItems() {
    var suggest = suggestEl();
    return suggest ? Array.prototype.slice.call(suggest.querySelectorAll("li[role='option']")) : [];
  }

  function syncActive() {
    var input = inputEl();
    if (!input) return;
    var items = optionItems();
    var activeItem = items[selected];
    if (activeItem) input.setAttribute("aria-activedescendant", activeItem.id);
    else input.removeAttribute("aria-activedescendant");
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderSuggest(state) {
    var suggest = suggestEl();
    var input = inputEl();
    if (!suggest || !input) return;
    hits = state.hits || [];
    var open = hits.length > 0 || Boolean(state.hint);
    selected = open && hits.length ? 0 : -1;
    suggest.hidden = !open;
    fieldEl()?.classList.toggle("is-open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
    var hint = state.hint ? '<li class="suggest-hint" role="note">' + esc(state.hint) + "</li>" : "";
    var options = hits.map(function (hit, index) {
      var id = "vg-att-opt-" + index;
      var sel = index === selected;
      return '<li id="' + id + '" role="option" aria-selected="' + (sel ? "true" : "false") + '"><button type="button" data-index="' + index + '">' + esc(hit.label) + "</button></li>";
    }).join("");
    suggest.innerHTML = options + hint;
    syncActive();
  }

  function insertTextFor(hit) {
    var text = String((hit && (hit.insertText || hit.label)) || "");
    if (hit && hit.kind === "book" && text && text.charAt(text.length - 1) !== " ") return text + " ";
    return text;
  }

  function looksLikeUrl(raw) {
    var q = String(raw || "").trim().toLowerCase();
    return q.indexOf("http://") === 0 || q.indexOf("https://") === 0 || q.indexOf("www.") === 0;
  }

  function suggestNow() {
    var input = inputEl();
    if (!input) return;
    var q = input.value;
    var mine = ++suggestSeq;
    if (!String(q).trim() || looksLikeUrl(q)) {
      closeSuggest();
      return;
    }
    fetch("/api/jump-suggest?q=" + encodeURIComponent(q), { headers: { accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || mine !== suggestSeq) return;
        renderSuggest(data);
      })
      .catch(function () {});
  }

  function scheduleSuggest() {
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = setTimeout(suggestNow, 40);
  }

  function moveHighlight(delta) {
    var items = optionItems();
    if (!items.length) return;
    selected = (selected + delta + items.length) % items.length;
    items.forEach(function (item, index) {
      item.setAttribute("aria-selected", index === selected ? "true" : "false");
    });
    syncActive();
  }

  function showDialogError(message) {
    var status = statusEl();
    if (status) {
      status.textContent = message;
      status.classList.add("is-error");
    }
    zoneEl()?.classList.add("is-bad");
  }

  function openDialog(card) {
    active = card;
    var input = inputEl();
    var status = statusEl();
    if (status) { status.textContent = ""; status.classList.remove("is-error"); }
    if (input) input.value = "";
    zoneEl()?.classList.remove("is-over", "is-ok", "is-bad");
    document.getElementById("vg-att-drop-check")?.setAttribute("hidden", "");
    closeSuggest();
    if (dialog && dialog.showModal) dialog.showModal();
    input?.focus();
  }

  function attachText(raw) {
    var text = String(raw || "").trim();
    if (!active) return;
    if (!text) {
      showDialogError("Need a passage or an http(s) link.");
      return;
    }
    post(active, "add-member", { text: text }, { dialog: true });
  }

  function applyHit(hit) {
    var input = inputEl();
    if (!hit || !input) return;
    var next = insertTextFor(hit);
    input.value = next;
    fetch("/api/jump-suggest?q=" + encodeURIComponent(next), { headers: { accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.canGo) {
          attachText(next);
          return;
        }
        input.focus();
        if (input.setSelectionRange) input.setSelectionRange(next.length, next.length);
        suggestNow();
      })
      .catch(function () { suggestNow(); });
  }

  panel.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var card = target.closest(".verse-group");
    if (!card || card.getAttribute("data-busy") === "1") return;
    if (target.closest("[data-vg-topic]")) {
      event.preventDefault();
      post(card, "suggest-title", null, { topic: true });
      return;
    }
    if (target.closest("[data-vg-attach]")) {
      event.preventDefault();
      openDialog(card);
      return;
    }
    var starBtn = target.closest("[data-vg-star]");
    if (starBtn) {
      event.preventDefault();
      var starSlug = starBtn.getAttribute("data-att-slug");
      if (!starSlug) return;
      post(card, "set-star", { slug: starSlug }, { star: true });
      return;
    }
    var remove = target.closest(".att-remove");
    if (remove) {
      event.preventDefault();
      var item = remove.closest(".att-item");
      var chip = item && item.querySelector(".att-chip");
      var slug = chip && chip.getAttribute("data-att-slug");
      if (slug) post(card, "remove-member", { slug: slug });
    }
  });

  panel.addEventListener("toggle", function (event) {
    var card = event.target;
    if (!card || !card.classList || !card.classList.contains("verse-group")) return;
    if (card.open) {
      card.classList.remove("is-collapsed-hover");
      return;
    }
    var summary = card.querySelector("summary");
    if (summary && document.activeElement === summary) summary.blur();
    if (!card.matches(":hover")) return;
    card.classList.add("is-collapsed-hover");
    card.addEventListener("pointerleave", function () {
      card.classList.remove("is-collapsed-hover");
    }, { once: true });
  }, true);

  panel.addEventListener("input", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.name !== "title" && target.name !== "description") return;
    var card = target.closest(".verse-group");
    if (card) scheduleSave(card);
  });

  panel.addEventListener("focusout", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.name !== "title" && target.name !== "description") return;
    var card = target.closest(".verse-group");
    if (!card || !card._saveTimer) return;
    clearTimeout(card._saveTimer);
    card._saveTimer = 0;
    post(card, "save", null, { quiet: true });
  });

  panel.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.closest) return;
    event.preventDefault();
    var card = form.closest(".verse-group");
    if (!card) return;
    if (card._saveTimer) { clearTimeout(card._saveTimer); card._saveTimer = 0; }
    post(card, "save", null, { quiet: true });
  });

  function scheduleSave(card) {
    if (card._saveTimer) clearTimeout(card._saveTimer);
    card._saveTimer = setTimeout(function () {
      card._saveTimer = 0;
      post(card, "save", null, { quiet: true });
    }, 400);
  }

  function paintStar(card, slug) {
    card.setAttribute("data-star", slug || "");
    var board = card.querySelector(".att-board");
    var items = Array.prototype.slice.call(card.querySelectorAll(".att-item"));
    var starred = null;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var chip = item.querySelector(".att-chip");
      var btn = item.querySelector("[data-vg-star]");
      var on = Boolean(slug && chip && chip.getAttribute("data-att-slug") === slug);
      if (btn) {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "Clear star" : "Star this verse");
        btn.setAttribute("title", on ? "Clear star" : "Star this verse");
      }
      if (on) starred = item;
    }
    if (!board) return;
    if (starred) {
      if (board.firstElementChild !== starred) board.insertBefore(starred, board.firstElementChild);
      return;
    }
    items.sort(function (a, b) {
      return Number(a.getAttribute("data-order")) - Number(b.getAttribute("data-order"));
    });
    for (var j = 0; j < items.length; j += 1) board.appendChild(items[j]);
  }

  function paintTitle(card) {
    var input = card.querySelector("input[name=title]");
    var title = input ? String(input.value || "").replace(/\\s+/g, " ").trim() : "";
    var hubLabel = card.getAttribute("data-hub-label") || "";
    var titleEl = card.querySelector(".note-row-title");
    if (titleEl) titleEl.textContent = title || hubLabel;
    var summary = card.querySelector("summary.note-row");
    var excerpt = summary && summary.querySelector(".note-row-excerpt");
    if (title && hubLabel && title !== hubLabel) {
      if (!excerpt && summary) {
        excerpt = document.createElement("span");
        excerpt.className = "note-row-excerpt";
        summary.appendChild(excerpt);
      }
      if (excerpt) excerpt.textContent = hubLabel;
    } else if (excerpt) {
      excerpt.remove();
    }
  }

  if (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      active = null;
      closeSuggest();
    });
    document.getElementById("vg-att-drop-form")?.addEventListener("submit", function (event) {
      event.preventDefault();
    });
    document.getElementById("vg-att-drop-close")?.addEventListener("click", function (event) {
      event.preventDefault();
      dialog.close();
    });
    document.getElementById("vg-att-drop-add")?.addEventListener("click", function (event) {
      event.preventDefault();
      attachText(inputEl() ? inputEl().value : "");
    });
    var input = inputEl();
    input?.addEventListener("input", scheduleSuggest);
    input?.addEventListener("keydown", function (event) {
      var items = optionItems();
      if (event.key === "ArrowDown") {
        if (!items.length) return;
        event.preventDefault();
        moveHighlight(1);
        return;
      }
      if (event.key === "ArrowUp") {
        if (!items.length) return;
        event.preventDefault();
        moveHighlight(-1);
        return;
      }
      if (event.key === "Tab" && selected >= 0 && items.length) {
        event.preventDefault();
        applyHit(hits[selected]);
        return;
      }
      if (event.key === "Escape") {
        var suggest = suggestEl();
        if (suggest && !suggest.hidden) {
          event.preventDefault();
          event.stopPropagation();
          closeSuggest();
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (selected >= 0 && items.length) {
          applyHit(hits[selected]);
          return;
        }
        attachText(event.currentTarget.value || "");
      }
    });
    suggestEl()?.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("button[data-index]");
      if (!button) return;
      event.preventDefault();
      var index = Number(button.getAttribute("data-index"));
      if (!Number.isFinite(index) || !hits[index]) return;
      applyHit(hits[index]);
    });
    var zone = zoneEl();
    zone?.addEventListener("dragover", function (event) {
      event.preventDefault();
      zone.classList.add("is-over");
    });
    zone?.addEventListener("dragleave", function (event) {
      if (!zone.contains(event.relatedTarget)) zone.classList.remove("is-over");
    });
    zone?.addEventListener("drop", function (event) {
      event.preventDefault();
      zone.classList.remove("is-over");
      var text = (event.dataTransfer && (event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain"))) || "";
      attachText(text);
    });
    zone?.addEventListener("paste", function (event) {
      var text = (event.clipboardData && event.clipboardData.getData("text/plain")) || "";
      if (!String(text).trim()) return;
      event.preventDefault();
      attachText(text);
    });
  }

  function post(card, action, extra, opts) {
    var quiet = Boolean(opts && opts.quiet);
    if (quiet) {
      if (card.getAttribute("data-save-inflight") === "1") {
        card.setAttribute("data-save-pending", "1");
        return;
      }
      card.setAttribute("data-save-inflight", "1");
    } else if (card.getAttribute("data-busy") === "1") {
      return;
    } else {
      card.setAttribute("data-busy", "1");
    }
    var hub = card.getAttribute("data-hub");
    var status = card.querySelector(".verse-group-status");
    var pending = action === "add-member" ? "Attaching…" : action === "remove-member" ? "Removing…" : action === "suggest-title" ? "Finding a topic…" : "Saving…";
    if (status && !quiet && !(opts && opts.dialog)) status.textContent = pending;
    var body = { action: action, hub: hub };
    if (action === "save") {
      var form = card.querySelector(".verse-group-form");
      if (form) {
        var data = new FormData(form);
        body.title = String(data.get("title") || "");
        body.description = String(data.get("description") || "");
      }
    }
    if (extra) {
      Object.keys(extra).forEach(function (key) { body[key] = extra[key]; });
    }
    fetch("/api/verse-groups", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (payload) {
        return { ok: response.ok, payload: payload };
      });
    }).then(function (result) {
      var payload = result.payload || {};
      if (!result.ok || !payload.ok) {
        card.removeAttribute("data-busy");
        card.removeAttribute("data-save-inflight");
        var message = payload.error || "Could not save.";
        if (opts && opts.dialog) showDialogError(message);
        else if (status) status.textContent = message;
        return;
      }
      if (quiet) {
        paintTitle(card);
        if (status) status.textContent = "";
        card.removeAttribute("data-save-inflight");
        if (card.getAttribute("data-save-pending") === "1") {
          card.removeAttribute("data-save-pending");
          post(card, "save", null, { quiet: true });
        }
        return;
      }
      if (opts && opts.star) {
        paintStar(card, typeof payload.star === "string" ? payload.star : "");
        card.removeAttribute("data-busy");
        if (status) status.textContent = "";
        return;
      }
      if (opts && opts.topic) {
        var titleInput = card.querySelector("input[name=title]");
        if (titleInput && payload.topic) titleInput.value = payload.topic;
        paintTitle(card);
        card.removeAttribute("data-busy");
        if (status) status.textContent = "";
        post(card, "save", null, { quiet: true });
        return;
      }
      try {
        sessionStorage.setItem(OPEN_KEY, "1");
        sessionStorage.setItem(FLASH_KEY, JSON.stringify({ hub: hub, message: payload.status || "Saved." }));
      } catch (err) {}
      location.reload();
    }).catch(function () {
      card.removeAttribute("data-busy");
      card.removeAttribute("data-save-inflight");
      if (opts && opts.dialog) showDialogError("Could not save.");
      else if (status) status.textContent = "Could not save.";
    });
  }
})();`;
}

function verseChipHtml(member: VerseGroupMember, starred: boolean, order: number): string {
  const id = `vg_${member.slug.replaceAll(".", "_")}`;
  const title = escapeHtml(member.label);
  const starLabel = starred ? "Clear star" : "Star this verse";
  return `<li class="att-item" data-order="${order}"><button type="button" class="verse-star" data-vg-star data-att-slug="${escapeHtml(member.slug)}" aria-pressed="${starred ? "true" : "false"}" aria-label="${starLabel}" title="${starLabel}">${iconStar()}</button><a class="att-chip wiki" href="${escapeHtml(hrefForXref(member.slug))}" data-att-id="${escapeHtml(id)}" data-att-kind="xref" data-att-slug="${escapeHtml(member.slug)}" data-att-title="${title}" data-att-source="manual">${title}</a><button type="button" class="att-remove" data-att-id="${escapeHtml(id)}" aria-label="Remove attachment" title="Remove attachment">${iconX(12)}</button></li>`;
}

function iconStar(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M8 1.4 9.8 5.7l4.6.4-3.5 3 1.1 4.5L8 11.3 4 13.6l1.1-4.5-3.5-3 4.6-.4Z"/></svg>`;
}

function iconTopic(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 1.2 9.2 6.1 14.1 8 9.2 9.9 8 14.8 6.8 9.9 1.9 8 6.8 6.1Z"/></svg>`;
}

function attachDialogHtml(): string {
  return `<dialog class="att-drop" id="vg-att-drop">
  <form method="dialog" class="att-drop-sheet" id="vg-att-drop-form">
    <button type="button" class="att-drop-close" id="vg-att-drop-close" aria-label="Close">${iconX(18)}</button>
    <div class="att-drop-zone" id="vg-att-drop-zone">
      <p class="att-drop-check" id="vg-att-drop-check" hidden>✓</p>
      <p class="att-drop-title" id="vg-att-drop-title">Drop a link. Or a passage.</p>
      <p class="att-drop-sub" id="vg-att-drop-sub">Paste a URL, or type John 3:16. It stays on this note as a chip — not mixed into the outline.</p>
      <label class="sr-only" for="vg-att-drop-input">Link or passage</label>
      <div class="att-drop-field">
        <input id="vg-att-drop-input" class="att-drop-input" type="text" autocomplete="off" spellcheck="false" placeholder="https://…  or  Romans 8:28" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="vg-att-drop-suggest">
        <ul id="vg-att-drop-suggest" class="suggest" role="listbox" hidden></ul>
      </div>
      <button type="button" class="att-drop-add" id="vg-att-drop-add">Attach</button>
    </div>
    <p class="att-drop-status" id="vg-att-drop-status" role="status" aria-live="polite"></p>
  </form>
</dialog>`;
}

function verseGroupsIcon(): string {
  return `<svg class="bookmarks-summary-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5" fill="currentColor"/><circle cx="12.6" cy="3.4" r="1.5" fill="currentColor"/><circle cx="12.6" cy="12.6" r="1.5" fill="currentColor"/><path d="M4.6 7.3 11.1 4.1M4.6 8.7 11.1 11.8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`;
}

function iconPaperclip(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M209.66 122.34a8 8 0 0 1 0 11.32l-82.05 82a56 56 0 0 1-79.2-79.2l83.28-83.28a40 40 0 0 1 56.56 56.56L105.37 192.63a24 24 0 1 1-33.94-33.94l83.28-83.28a8 8 0 1 1 11.32 11.32L82.75 170a8 8 0 1 0 11.31 11.32l82.88-82.88a24 24 0 0 0-33.94-33.94L59.72 148.79a40 40 0 0 0 56.56 56.56l82.05-82a8 8 0 0 1 11.32 0Z"/></svg>`;
}

function iconX(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31 61.66 205.66a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66A8 8 0 0 1 61.66 50.34L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>`;
}
