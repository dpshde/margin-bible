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
  return `<details class="verse-group" data-hub="${escapeHtml(group.hub)}" data-hub-label="${escapeHtml(group.hubLabel)}" data-star="${escapeHtml(star)}" data-sample="${group.sample ? "1" : "0"}" data-seed="${group.seed ? "1" : "0"}" data-auto-titled="${group.autoTitled ? "1" : "0"}">
  <summary class="note-row"><span class="note-row-title" data-title="${escapeHtml(saved)}" contenteditable="false">${escapeHtml(rowTitle)}</span><button type="button" class="verse-group-title-edit" aria-label="Edit title" title="Edit title">${iconNotePencil()}</button>${excerpt ? `<span class="note-row-excerpt">${escapeHtml(excerpt)}</span>` : ""}<span class="verse-group-hub">${escapeHtml(group.hubLabel)}</span></summary>
  <form class="verse-group-form">
    <div class="verse-group-fields">
      <textarea id="vg-description-${field}" class="verse-group-description" name="description" rows="1" maxlength="2000" placeholder="Description" aria-label="Description">${escapeHtml(group.description)}</textarea>
    </div>
    <div class="verse-group-verses">
      <ul class="att-board verse-group-members">${chips}</ul>
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

  var drag = null;
  var suppressClick = false;
  var memberRev = 0;

  function memberItem(card, slug) {
    var items = card.querySelectorAll(".att-item");
    for (var i = 0; i < items.length; i += 1) {
      var chip = items[i].querySelector(".att-chip");
      if (chip && chip.getAttribute("data-att-slug") === slug) return items[i];
    }
    return null;
  }

  function memberSnapshot(cards) {
    var snaps = [];
    for (var i = 0; i < cards.length; i += 1) {
      var list = cards[i].querySelector(".verse-group-members");
      snaps.push({
        card: cards[i],
        html: list ? list.innerHTML : "",
        star: cards[i].getAttribute("data-star") || "",
      });
    }
    return snaps;
  }

  function beginMemberChange(cards) {
    memberRev += 1;
    return { rev: memberRev, snaps: memberSnapshot(cards) };
  }

  function undoMemberChange(token) {
    if (!token || token.rev !== memberRev) {
      location.reload();
      return;
    }
    var snaps = token.snaps;
    for (var i = 0; i < snaps.length; i += 1) {
      var list = snaps[i].card.querySelector(".verse-group-members");
      if (list) list.innerHTML = snaps[i].html;
      paintStar(snaps[i].card, snaps[i].star);
    }
  }

  function clearPressed(item) {
    var btn = item.querySelector("[data-vg-star]");
    if (!btn) return;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Star this verse");
    btn.setAttribute("title", "Star this verse");
  }

  var pointerAt = { x: 0, y: 0 };

  function rememberPointer(event) {
    if (!event || typeof event.clientX !== "number") return;
    pointerAt = { x: event.clientX, y: event.clientY };
  }

  function releaseMemberQuiet(event) {
    rememberPointer(event);
    var cards = panel.querySelectorAll(".verse-group.is-member-quiet");
    for (var i = 0; i < cards.length; i += 1) {
      var origin = cards[i]._quietPointer;
      if (!origin) continue;
      if (Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y) < 4) continue;
      cards[i].classList.remove("is-member-quiet");
      cards[i]._quietPointer = null;
    }
  }

  function quietMemberHover(card) {
    if (!card) return;
    card.classList.add("is-member-quiet");
    card._quietPointer = { x: pointerAt.x, y: pointerAt.y };
  }

  function blurRemovedMember(card, item) {
    var active = document.activeElement;
    if (active && item && item.contains(active)) active.blur();
    active = document.activeElement;
    if (!active || !active.closest || active === document.body) return;
    if (card.contains(active) && active.closest(".att-item")) active.blur();
  }

  window.addEventListener("pointerdown", rememberPointer);
  window.addEventListener("pointermove", releaseMemberQuiet);

  function applyMemberRemove(card, slug) {
    var item = memberItem(card, slug);
    if (!item) return;
    quietMemberHover(card);
    blurRemovedMember(card, item);
    item.remove();
    blurRemovedMember(card, null);
    if ((card.getAttribute("data-star") || "") === slug) paintStar(card, "");
  }

  function applyMemberMove(fromCard, toCard, slug) {
    var item = memberItem(fromCard, slug);
    var list = toCard.querySelector(".verse-group-members");
    if (!item || !list) return;
    quietMemberHover(fromCard);
    quietMemberHover(toCard);
    if (slug === fromCard.getAttribute("data-hub")) {
      if (memberItem(toCard, slug)) return;
      var copy = item.cloneNode(true);
      clearPressed(copy);
      list.appendChild(copy);
      return;
    }
    if ((fromCard.getAttribute("data-star") || "") === slug) paintStar(fromCard, "");
    if (memberItem(toCard, slug)) {
      item.remove();
      return;
    }
    clearPressed(item);
    list.appendChild(item);
  }

  function dropCard(card) {
    if (!card) return;
    var li = card.parentNode;
    if (li && li.tagName === "LI" && li.parentNode) li.parentNode.removeChild(li);
    else card.remove();
  }

  function cardByHub(hub) {
    var cards = panel.querySelectorAll(".verse-group");
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].getAttribute("data-hub") === hub) return cards[i];
    }
    return null;
  }

  function clearDrop() {
    var marked = panel.querySelectorAll(".verse-group.is-drop");
    for (var i = 0; i < marked.length; i += 1) marked[i].classList.remove("is-drop");
  }

  function groupAt(x, y) {
    var ghost = drag && drag.ghost;
    if (ghost) ghost.hidden = true;
    var el = document.elementFromPoint(x, y);
    if (ghost) ghost.hidden = false;
    var card = el && el.closest && el.closest(".verse-group");
    if (!card || !panel.contains(card)) return null;
    return card;
  }

  function endDrag(commit, x, y) {
    if (!drag) return;
    var state = drag;
    drag = null;
    clearDrop();
    if (state.item) state.item.classList.remove("is-dragging");
    if (state.ghost) state.ghost.remove();
    if (!commit || !state.active) return;
    suppressClick = true;
    var target = groupAt(x, y);
    var to = target && target.getAttribute("data-hub");
    if (!target || !to || to === state.hub) return;
    var fromCard = cardByHub(state.hub);
    if (!fromCard) return;
    var token = beginMemberChange([fromCard, target]);
    applyMemberMove(fromCard, target, state.slug);
    post(target, "move-member", { slug: state.slug, from: state.hub }, {
      member: true,
      rev: token.rev,
      undo: function () { undoMemberChange(token); },
    });
  }

  panel.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    var item = event.target && event.target.closest && event.target.closest(".verse-group .att-item");
    if (!item || !panel.contains(item)) return;
    if (event.target.closest("button")) return;
    var card = item.closest(".verse-group");
    var chip = item.querySelector(".att-chip");
    var slug = chip && chip.getAttribute("data-att-slug");
    var hub = card && card.getAttribute("data-hub");
    if (!card || !slug || !hub || card.getAttribute("data-busy") === "1") return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      slug: slug,
      hub: hub,
      label: chip.textContent || slug,
      item: item,
      active: false,
      ghost: null,
    };
  });

  window.addEventListener("pointermove", function (event) {
    if (!drag || event.pointerId !== drag.id) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    if (!drag.active) {
      if (dx * dx + dy * dy < 36) return;
      drag.active = true;
      drag.item.classList.add("is-dragging");
      var ghost = document.createElement("div");
      ghost.className = "verse-group-drag-ghost";
      ghost.textContent = drag.label;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      if (drag.item.setPointerCapture) drag.item.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    if (drag.ghost) {
      drag.ghost.style.left = event.clientX + "px";
      drag.ghost.style.top = event.clientY + "px";
    }
    clearDrop();
    var target = groupAt(event.clientX, event.clientY);
    var to = target && target.getAttribute("data-hub");
    if (target && to && to !== drag.hub) target.classList.add("is-drop");
  });

  window.addEventListener("pointerup", function (event) {
    if (!drag || event.pointerId !== drag.id) return;
    endDrag(true, event.clientX, event.clientY);
  });

  window.addEventListener("pointercancel", function (event) {
    if (!drag || event.pointerId !== drag.id) return;
    endDrag(false, event.clientX, event.clientY);
  });

  panel.addEventListener("click", function (event) {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var target = event.target;
    if (!target || !target.closest) return;
    var card = target.closest(".verse-group");
    if (!card || card.getAttribute("data-busy") === "1") return;
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
      if (!slug) return;
      var token = beginMemberChange([card]);
      applyMemberRemove(card, slug);
      post(card, "remove-member", { slug: slug }, {
        member: true,
        rev: token.rev,
        undo: function () { undoMemberChange(token); },
      });
    }
  });

  panel.addEventListener("toggle", function (event) {
    var card = event.target;
    if (!card || !card.classList || !card.classList.contains("verse-group")) return;
    card._titlePointer = false;
    syncTitleEdit(card);
    if (card.open) {
      card.classList.remove("is-collapsed-hover");
      preloadMembers(card);
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

  var groups = panel.querySelectorAll(".verse-group");
  for (var groupIndex = 0; groupIndex < groups.length; groupIndex += 1) guardTitleToggle(groups[groupIndex]);
  var openGroups = panel.querySelectorAll(".verse-group[open]");
  for (var openIndex = 0; openIndex < openGroups.length; openIndex += 1) {
    syncTitleEdit(openGroups[openIndex]);
    preloadMembers(openGroups[openIndex]);
  }

  panel.addEventListener("pointerdown", function (event) {
    var cards = panel.querySelectorAll(".verse-group");
    for (var i = 0; i < cards.length; i += 1) cards[i]._titlePointer = false;
    var target = event.target;
    if (!target || !target.closest) return;
    var pencil = target.closest(".verse-group-title-edit");
    var title = target.closest(".note-row-title");
    var hit = pencil || title;
    if (!hit || !panel.contains(hit)) return;
    var card = hit.closest(".verse-group");
    if (!card) return;
    if (pencil || title.getAttribute("contenteditable") === "true") card._titlePointer = true;
  }, true);

  panel.addEventListener("click", function (event) {
    var pencil = event.target && event.target.closest && event.target.closest(".verse-group-title-edit");
    if (!pencil || !panel.contains(pencil)) return;
    event.preventDefault();
    event.stopPropagation();
    var card = pencil.closest(".verse-group");
    if (!card) return;
    card._titlePointer = false;
    beginTitleEdit(card);
  }, true);

  panel.addEventListener("keydown", function (event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains("note-row-title")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      target.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      var card = target.closest(".verse-group");
      var back = card && card._titleOnFocus != null ? String(card._titleOnFocus) : "";
      target.setAttribute("data-title", back);
      if (!card) {
        target.blur();
        return;
      }
      if (card._saveTimer) { clearTimeout(card._saveTimer); card._saveTimer = 0; }
      scheduleSave(card);
      target.blur();
    }
  });

  panel.addEventListener("paste", function (event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains("note-row-title")) return;
    event.preventDefault();
    var text = (event.clipboardData && event.clipboardData.getData("text/plain")) || "";
    text = String(text).replace(/\\s+/g, " ");
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });

  panel.addEventListener("focusin", function (event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains("note-row-title")) return;
    var card = target.closest(".verse-group");
    if (!card) return;
    card._titleOnFocus = target.getAttribute("data-title") || "";
  });

  panel.addEventListener("input", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var card = target.closest(".verse-group");
    if (!card) return;
    if (target.classList && target.classList.contains("note-row-title")) {
      var raw = String(target.textContent || "").replace(/\\u00a0/g, " ").replace(/\\s+/g, " ").trim();
      if (raw.length > 120) {
        raw = raw.slice(0, 120);
        target.textContent = raw;
      }
      var hubLabel = card.getAttribute("data-hub-label") || "";
      if (!String(card._titleOnFocus || "").trim() && raw === hubLabel) raw = "";
      target.setAttribute("data-title", raw);
      paintTitle(card, true);
      scheduleSave(card);
      return;
    }
    if (target.name !== "description") return;
    scheduleSave(card);
  });

  panel.addEventListener("focusout", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var card = target.closest(".verse-group");
    if (!card) return;
    var titleEdit = target.classList && target.classList.contains("note-row-title");
    if (!titleEdit && target.name !== "description") return;
    if (titleEdit) {
      paintTitle(card);
      target.setAttribute("contenteditable", "false");
      target.removeAttribute("role");
      target.removeAttribute("aria-multiline");
      target.removeAttribute("aria-label");
    }
    if (!card._saveTimer) return;
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

  function preloadMembers(card) {
    if (!card || !card.open) return;
    var preload = window.__marginPreloadHrefs;
    if (typeof preload !== "function") return;
    var links = card.querySelectorAll("a.att-chip.wiki[href]");
    var hrefs = [];
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href");
      if (href) hrefs.push(href);
    }
    if (hrefs.length) preload(hrefs);
  }

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
    var domOrder = items.slice();
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
    items.sort(function (a, b) {
      return Number(a.getAttribute("data-order")) - Number(b.getAttribute("data-order"));
    });
    var ordered = [];
    if (starred) ordered.push(starred);
    for (var j = 0; j < items.length; j += 1) {
      if (items[j] !== starred) ordered.push(items[j]);
    }
    var moved = ordered.length !== domOrder.length;
    if (!moved) {
      for (var k = 0; k < ordered.length; k += 1) {
        if (ordered[k] !== domOrder[k]) { moved = true; break; }
      }
    }
    quietMemberHover(card);
    if (!moved) return;
    for (var n = 0; n < ordered.length; n += 1) board.appendChild(ordered[n]);
  }

  function guardTitleToggle(card) {
    card.addEventListener("beforetoggle", function (event) {
      if (card._titlePointer) event.preventDefault();
    });
  }

  function beginTitleEdit(card) {
    var el = card.querySelector(".note-row-title");
    if (!el) return;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-label", "Title");
    el.setAttribute("aria-multiline", "false");
    el.spellcheck = false;
    el.focus();
    if (String(el.getAttribute("data-title") || "").trim()) return;
    requestAnimationFrame(function () {
      var range = document.createRange();
      range.selectNodeContents(el);
      var selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }

  function syncTitleEdit(card) {
    var el = card.querySelector(".note-row-title");
    if (!el || card.open) return;
    if (document.activeElement === el) el.blur();
    el.setAttribute("contenteditable", "false");
    el.removeAttribute("role");
    el.removeAttribute("aria-multiline");
    el.removeAttribute("aria-label");
    paintTitle(card);
  }

  function storedTitle(card) {
    var el = card.querySelector(".note-row-title");
    var title = el ? String(el.getAttribute("data-title") || "") : "";
    return title.replace(/\\s+/g, " ").trim().slice(0, 120);
  }

  function paintTitle(card, keepText) {
    var el = card.querySelector(".note-row-title");
    if (!el) return;
    var title = storedTitle(card);
    var hubLabel = card.getAttribute("data-hub-label") || "";
    var editing = document.activeElement === el;
    if (!keepText && !editing) el.textContent = title || hubLabel;
    var summary = card.querySelector("summary.note-row");
    var excerpt = summary && summary.querySelector(".note-row-excerpt");
    if (title && hubLabel && title !== hubLabel) {
      if (!excerpt && summary) {
        excerpt = document.createElement("span");
        excerpt.className = "note-row-excerpt";
        var hub = summary.querySelector(".verse-group-hub");
        if (hub) summary.insertBefore(excerpt, hub);
        else summary.appendChild(excerpt);
      }
      if (excerpt) excerpt.textContent = hubLabel;
    } else if (excerpt) {
      excerpt.remove();
    }
  }

  function writeTitle(card, title) {
    var el = card.querySelector(".note-row-title");
    if (!el) return;
    var clean = String(title || "").replace(/\\s+/g, " ").trim().slice(0, 120);
    el.setAttribute("data-title", clean);
    var hubLabel = card.getAttribute("data-hub-label") || "";
    el.textContent = clean || hubLabel;
    paintTitle(card, true);
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
    var auto = Boolean(opts && opts.auto);
    function finishAuto() {
      if (!auto) return;
      card.removeAttribute("data-auto-title-inflight");
      if (opts && typeof opts.done === "function") opts.done();
    }
    if (auto) {
      if (card.getAttribute("data-auto-title-inflight") === "1") return;
      card.setAttribute("data-auto-title-inflight", "1");
    } else if (quiet) {
      if (card.getAttribute("data-save-inflight") === "1") {
        card.setAttribute("data-save-pending", "1");
        return;
      }
      card.setAttribute("data-save-inflight", "1");
    } else if (opts && opts.member) {
      /* The chip is already in its new place. Do not lock the card or reload. */
    } else if (card.getAttribute("data-busy") === "1") {
      return;
    } else {
      card.setAttribute("data-busy", "1");
    }
    var hub = card.getAttribute("data-hub");
    var status = card.querySelector(".verse-group-status");
    var pending = action === "add-member" ? "Attaching…" : action === "suggest-title" ? "Finding a topic…" : "Saving…";
    if (status && !quiet && !(opts && opts.dialog) && !(opts && opts.member)) status.textContent = pending;
    var body = { action: action, hub: hub };
    if (action === "save") {
      body.title = storedTitle(card);
      var form = card.querySelector(".verse-group-form");
      if (form) body.description = String(new FormData(form).get("description") || "");
    }
    if (action === "suggest-title") body.title = storedTitle(card);
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
        if (opts && opts.member && typeof opts.undo === "function") opts.undo();
        if (auto) {
          if (status) status.textContent = "";
          finishAuto();
          return;
        }
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
      if (opts && opts.member) {
        if (payload.sourceDissolved && extra && extra.from) dropCard(cardByHub(extra.from));
        if (payload.dissolved) dropCard(card);
        if (status) status.textContent = "";
        return;
      }
      if (opts && opts.topic) {
        var baseline = card._titleAtAuto == null ? "" : String(card._titleAtAuto);
        var current = storedTitle(card);
        if (payload.autoTitled) card.setAttribute("data-auto-titled", "1");
        if (payload.topic && current === baseline) writeTitle(card, payload.topic);
        card.removeAttribute("data-busy");
        if (status) status.textContent = "";
        finishAuto();
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
      if (opts && opts.member && typeof opts.undo === "function") opts.undo();
      if (auto) {
        if (status) status.textContent = "";
        finishAuto();
        return;
      }
      if (opts && opts.dialog) showDialogError("Could not save.");
      else if (status) status.textContent = "Could not save.";
    });
  }

  function autoTitlePass() {
    var cards = panel.querySelectorAll(".verse-group");
    var queue = [];
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].getAttribute("data-auto-titled") === "1") continue;
      if (cards[i].getAttribute("data-auto-title-started") === "1") continue;
      queue.push(cards[i]);
    }
    function run() {
      var card = queue.shift();
      if (!card) return;
      card.setAttribute("data-auto-title-started", "1");
      card._titleAtAuto = storedTitle(card);
      post(card, "suggest-title", null, { topic: true, auto: true, done: run });
    }
    run();
  }

  autoTitlePass();
})();`;
}

function verseChipHtml(member: VerseGroupMember, starred: boolean, order: number): string {
  const id = `vg_${member.slug.replaceAll(".", "_")}`;
  const title = escapeHtml(member.label);
  const starLabel = starred ? "Clear star" : "Star this verse";
  return `<li class="att-item" data-order="${order}"><a class="att-chip wiki" draggable="false" href="${escapeHtml(hrefForXref(member.slug))}" data-att-id="${escapeHtml(id)}" data-att-kind="xref" data-att-slug="${escapeHtml(member.slug)}" data-att-title="${title}" data-att-source="manual">${title}</a><span class="verse-group-member-actions"><button type="button" class="verse-star" data-vg-star data-att-slug="${escapeHtml(member.slug)}" aria-pressed="${starred ? "true" : "false"}" aria-label="${starLabel}" title="${starLabel}">${iconStar()}</button><button type="button" class="att-remove" data-att-id="${escapeHtml(id)}" aria-label="Remove attachment" title="Remove attachment">${iconX(12)}</button></span></li>`;
}

function iconStar(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 1.4 9.8 5.7l4.6.4-3.5 3 1.1 4.5L8 11.3 4 13.6l1.1-4.5-3.5-3 4.6-.4Z"/></svg>`;
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

function iconNotePencil(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="m229.66 58.34l-32-32a8 8 0 0 0-11.32 0l-96 96A8 8 0 0 0 88 128v32a8 8 0 0 0 8 8h32a8 8 0 0 0 5.66-2.34l96-96a8 8 0 0 0 0-11.32M124.69 152H104v-20.69l64-64L188.69 88ZM200 76.69L179.31 56L192 43.31L212.69 64ZM224 128v80a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h80a8 8 0 0 1 0 16H48v160h160v-80a8 8 0 0 1 16 0"/></svg>`;
}

function iconPaperclip(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M209.66 122.34a8 8 0 0 1 0 11.32l-82.05 82a56 56 0 0 1-79.2-79.2l83.28-83.28a40 40 0 0 1 56.56 56.56L105.37 192.63a24 24 0 1 1-33.94-33.94l83.28-83.28a8 8 0 1 1 11.32 11.32L82.75 170a8 8 0 1 0 11.31 11.32l82.88-82.88a24 24 0 0 0-33.94-33.94L59.72 148.79a40 40 0 0 0 56.56 56.56l82.05-82a8 8 0 0 1 11.32 0Z"/></svg>`;
}

function iconX(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31 61.66 205.66a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66A8 8 0 0 1 61.66 50.34L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>`;
}
