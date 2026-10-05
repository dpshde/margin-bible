/**
 * Inbox surface for verse webs. One flat container beside Bookmarks.
 * Verses are the same chips as outliner attachments, added through the same dialog.
 */
import { escapeHtml } from "./html";
import { JEV_TOPICS } from "./jev-topics";
import type { VerseGroupMember, VerseGroupView } from "./verse-groups";
import { hrefForXref } from "./xref";

export function verseGroupsButtonHtml(): string {
  return `<button type="button" class="verse-groups-btn" id="verse-groups-btn" aria-expanded="false" aria-controls="verse-groups-panel">${verseGroupsIcon()}<span>Verse groups</span></button>`;
}

export function verseGroupsPanelHtml(groups: readonly VerseGroupView[]): string {
  const groupsHtml = groups.map((group) => verseGroupCardHtml(group)).join("");
  return `<section id="verse-groups-panel" class="verse-groups-panel" hidden aria-label="Verse groups">${groupsHtml}</section>${attachDialogHtml()}`;
}

export function verseGroupCardHtml(group: VerseGroupView, status = ""): string {
  const field = group.hub.replaceAll(".", "-");
  const chips = group.members.map((member) => verseChipHtml(member)).join("");
  const saveLabel = group.sample ? "Save sample to this library" : "Save";
  const title = group.title.trim() || group.suggestedTitle || "";
  const descriptionOpen = group.description.trim() ? " open" : "";
  return `<div class="verse-group" data-hub="${escapeHtml(group.hub)}" data-sample="${group.sample ? "1" : "0"}" data-seed="${group.seed ? "1" : "0"}">
  <form class="verse-group-form">
    <div class="verse-group-title-row">
      <input id="vg-title-${field}" name="title" value="${escapeHtml(title)}" placeholder="Name this web" maxlength="120" autocomplete="off" aria-label="Title">
      <button type="button" class="verse-group-topic-toggle" data-vg-topics aria-expanded="false">Topic</button>
    </div>
    ${topicPickerHtml(group.topicParent)}
    <details class="verse-group-description"${descriptionOpen}>
      <summary>Description <span class="verse-group-optional">optional</span></summary>
      <textarea id="vg-description-${field}" name="description" rows="2" maxlength="2000" placeholder="What holds these together?" aria-label="Description">${escapeHtml(group.description)}</textarea>
    </details>
    <div class="verse-group-verses">
      <ul class="att-board">${chips}</ul>
      <button type="button" class="tray-attach" data-vg-attach aria-label="Attach a link or passage" title="Attach">${iconPaperclip()}</button>
    </div>
    <button type="submit" class="verse-group-save">${saveLabel}</button>
    <p class="verse-group-status" role="status">${escapeHtml(status)}</p>
  </form>
</div>`;
}

function topicPickerHtml(nearestParent: string | undefined): string {
  const parents = JEV_TOPICS.map((parent) => {
    const current = parent.id === nearestParent ? ` aria-current="true"` : "";
    return `<button type="button" class="verse-group-topic" data-vg-topic-parent="${escapeHtml(parent.id)}"${current}>${escapeHtml(parent.label)}</button>`;
  }).join("");
  const children = JEV_TOPICS.map((parent) => {
    const kids = parent.children
      .map(
        (child) =>
          `<button type="button" class="verse-group-topic" data-vg-topic-child="${escapeHtml(child.label)}">${escapeHtml(child.label)}</button>`,
      )
      .join("");
    return `<div class="verse-group-topic-children verse-group-topic-row" data-parent="${escapeHtml(parent.id)}" hidden><button type="button" class="verse-group-topic" data-vg-topic-back>Back</button>${kids}</div>`;
  }).join("");
  return `<div class="verse-group-topics" hidden>
    <div class="verse-group-topic-parents verse-group-topic-row">${parents}</div>
    ${children}
  </div>`;
}

export function verseGroupsScript(): string {
  return `(() => {
  var btn = document.getElementById("verse-groups-btn");
  var panel = document.getElementById("verse-groups-panel");
  var dialog = document.getElementById("vg-att-drop");
  if (!btn || !panel) return;
  var OPEN_KEY = "margin_verse_groups_open";
  var FLASH_KEY = "margin_verse_groups_flash";
  var active = null;
  var hits = [];
  var selected = -1;
  var suggestTimer = null;
  var suggestSeq = 0;

  function setOpen(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
  }

  btn.addEventListener("click", function () {
    setOpen(panel.hasAttribute("hidden"));
  });

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
    if (target.closest("[data-vg-attach]")) {
      event.preventDefault();
      openDialog(card);
      return;
    }
    if (target.closest("[data-vg-topics]")) {
      event.preventDefault();
      var box = card.querySelector(".verse-group-topics");
      var toggle = card.querySelector("[data-vg-topics]");
      if (!box) return;
      var show = box.hasAttribute("hidden");
      if (show) box.removeAttribute("hidden");
      else box.setAttribute("hidden", "");
      if (toggle) toggle.setAttribute("aria-expanded", show ? "true" : "false");
      showTopicParents(card);
      return;
    }
    var parentBtn = target.closest("[data-vg-topic-parent]");
    if (parentBtn) {
      event.preventDefault();
      showTopicChildren(card, parentBtn.getAttribute("data-vg-topic-parent"));
      return;
    }
    if (target.closest("[data-vg-topic-back]")) {
      event.preventDefault();
      showTopicParents(card);
      return;
    }
    var childBtn = target.closest("[data-vg-topic-child]");
    if (childBtn) {
      event.preventDefault();
      var titleInput = card.querySelector("input[name=title]");
      if (titleInput) titleInput.value = childBtn.getAttribute("data-vg-topic-child") || "";
      var topicBox = card.querySelector(".verse-group-topics");
      if (topicBox) topicBox.setAttribute("hidden", "");
      var topicToggle = card.querySelector("[data-vg-topics]");
      if (topicToggle) topicToggle.setAttribute("aria-expanded", "false");
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

  function showTopicParents(card) {
    var parents = card.querySelector(".verse-group-topic-parents");
    if (parents) parents.removeAttribute("hidden");
    var lists = card.querySelectorAll(".verse-group-topic-children");
    for (var i = 0; i < lists.length; i++) lists[i].setAttribute("hidden", "");
  }

  function showTopicChildren(card, parentId) {
    var parents = card.querySelector(".verse-group-topic-parents");
    if (parents) parents.setAttribute("hidden", "");
    var lists = card.querySelectorAll(".verse-group-topic-children");
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].getAttribute("data-parent") === parentId) lists[i].removeAttribute("hidden");
      else lists[i].setAttribute("hidden", "");
    }
  }

  panel.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.closest) return;
    event.preventDefault();
    var card = form.closest(".verse-group");
    if (card) post(card, "save");
  });

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
    if (card.getAttribute("data-busy") === "1") return;
    card.setAttribute("data-busy", "1");
    var hub = card.getAttribute("data-hub");
    var status = card.querySelector(".verse-group-status");
    var pending = action === "add-member" ? "Attaching…" : action === "remove-member" ? "Removing…" : "Saving…";
    if (status && !(opts && opts.dialog)) status.textContent = pending;
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
        var message = payload.error || "Could not save.";
        if (opts && opts.dialog) showDialogError(message);
        else if (status) status.textContent = message;
        return;
      }
      try {
        sessionStorage.setItem(OPEN_KEY, "1");
        sessionStorage.setItem(FLASH_KEY, JSON.stringify({ hub: hub, message: payload.status || "Saved." }));
      } catch (err) {}
      location.reload();
    }).catch(function () {
      card.removeAttribute("data-busy");
      if (opts && opts.dialog) showDialogError("Could not save.");
      else if (status) status.textContent = "Could not save.";
    });
  }
})();`;
}

function verseChipHtml(member: VerseGroupMember): string {
  const id = `vg_${member.slug.replaceAll(".", "_")}`;
  const title = escapeHtml(member.label);
  return `<li class="att-item"><a class="att-chip wiki" href="${escapeHtml(hrefForXref(member.slug))}" data-att-id="${escapeHtml(id)}" data-att-kind="xref" data-att-slug="${escapeHtml(member.slug)}" data-att-title="${title}" data-att-source="manual">${title}</a><button type="button" class="att-remove" data-att-id="${escapeHtml(id)}" aria-label="Remove attachment" title="Remove attachment">${iconX(12)}</button></li>`;
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
  return `<svg class="verse-groups-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5" fill="currentColor"/><circle cx="12.6" cy="3.4" r="1.5" fill="currentColor"/><circle cx="12.6" cy="12.6" r="1.5" fill="currentColor"/><path d="M4.6 7.3 11.1 4.1M4.6 8.7 11.1 11.8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`;
}

function iconPaperclip(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M209.66 122.34a8 8 0 0 1 0 11.32l-82.05 82a56 56 0 0 1-79.2-79.2l83.28-83.28a40 40 0 0 1 56.56 56.56L105.37 192.63a24 24 0 1 1-33.94-33.94l83.28-83.28a8 8 0 1 1 11.32 11.32L82.75 170a8 8 0 1 0 11.31 11.32l82.88-82.88a24 24 0 0 0-33.94-33.94L59.72 148.79a40 40 0 0 0 56.56 56.56l82.05-82a8 8 0 0 1 11.32 0Z"/></svg>`;
}

function iconX(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31 61.66 205.66a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66A8 8 0 0 1 61.66 50.34L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>`;
}
