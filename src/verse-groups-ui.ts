/**
 * Inbox surface for verse webs. The control sits beside Bookmarks.
 * Naming and the cross-link fill post to /api/verse-groups. The fill stays
 * behind a preview until the user confirms, then offers undo.
 */
import { escapeHtml } from "./html";
import type { VerseGroupView } from "./verse-groups";

export function verseGroupsButtonHtml(): string {
  return `<button type="button" class="verse-groups-btn" id="verse-groups-btn" aria-expanded="false" aria-controls="verse-groups-panel">${verseGroupsIcon()}<span>Verse groups</span></button>`;
}

export function verseGroupsPanelHtml(groups: readonly VerseGroupView[]): string {
  const sampleOnly = groups.length === 1 && groups[0]?.sample;
  const lead = sampleOnly
    ? "Sample web — this library has no fan-in yet. Naming it saves these links here. Cross-links among members are not added unless you preview them and confirm."
    : "A verse shows up here when two or more of your notes point at it, or when one note points at two or more verses. Give the web a name if you want it back later.";
  const cards = groups.map((group) => verseGroupCardHtml(group)).join("");
  return `<section id="verse-groups-panel" class="verse-groups-panel" hidden aria-label="Verse groups"><p class="verse-groups-lead">${escapeHtml(lead)}</p>${cards}</section>`;
}

export function verseGroupCardHtml(group: VerseGroupView, status = ""): string {
  const field = group.hub.replaceAll(".", "-");
  const titleId = `vg-name-${field}`;
  const heading = group.title.trim() || "Untitled web";
  const badge = group.sample ? `<span class="verse-group-badge">Sample</span>` : "";
  const highlight = group.seed ? " is-highlight" : "";
  const members = group.members
    .map((member) => {
      const role = member.role === "hub" ? ` <span class="verse-group-role">hub</span>` : "";
      return `<li><a href="/${escapeHtml(member.slug)}">${escapeHtml(member.label)}</a>${role}</li>`;
    })
    .join("");
  const links = linksHtml(group);
  const saveLabel = group.sample ? "Save sample to this library" : "Save";
  return `<article class="verse-group${highlight}" data-hub="${escapeHtml(group.hub)}" data-sample="${group.sample ? "1" : "0"}" data-seed="${group.seed ? "1" : "0"}" aria-labelledby="${titleId}">
  <h2 class="verse-group-name" id="${titleId}">${escapeHtml(heading)}${badge}</h2>
  <p class="verse-group-why">${escapeHtml(group.why)}</p>
  <p class="verse-group-hub"><a href="/${escapeHtml(group.hub)}">${escapeHtml(group.hubLabel)}</a></p>
  <form class="verse-group-form">
    <label class="verse-group-field" for="vg-title-${field}">Title
      <input id="vg-title-${field}" name="title" value="${escapeHtml(group.title)}" placeholder="Name this web" maxlength="120" autocomplete="off">
    </label>
    <label class="verse-group-field" for="vg-description-${field}">Description
      <textarea id="vg-description-${field}" name="description" rows="3" maxlength="2000" placeholder="What holds these together?">${escapeHtml(group.description)}</textarea>
    </label>
    <button type="submit" class="verse-group-save">${saveLabel}</button>
    <p class="verse-group-status" role="status">${escapeHtml(status)}</p>
  </form>
  <h3 class="verse-group-members-label">Members</h3>
  <ul class="verse-group-members">${members}</ul>
  ${links}
</article>`;
}

export function verseGroupsScript(): string {
  return `(() => {
  var btn = document.getElementById("verse-groups-btn");
  var panel = document.getElementById("verse-groups-panel");
  if (!btn || !panel) return;
  var OPEN_KEY = "margin_verse_groups_open";
  var FLASH_KEY = "margin_verse_groups_flash";

  function setOpen(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    if (open && panel.scrollIntoView) panel.scrollIntoView({ block: "nearest" });
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

  panel.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var card = target.closest(".verse-group");
    if (!card || card.getAttribute("data-busy") === "1") return;
    if (target.closest(".verse-group-fill")) {
      var preview = card.querySelector(".verse-group-preview");
      if (preview) preview.hidden = false;
      var fill = target.closest(".verse-group-fill");
      if (fill) fill.setAttribute("aria-expanded", "true");
      return;
    }
    if (target.closest(".verse-group-fill-confirm")) {
      post(card, "add-links");
      return;
    }
    if (target.closest(".verse-group-undo")) post(card, "undo-links");
  });

  panel.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.closest) return;
    event.preventDefault();
    var card = form.closest(".verse-group");
    if (card) post(card, "save");
  });

  function post(card, action) {
    if (card.getAttribute("data-busy") === "1") return;
    card.setAttribute("data-busy", "1");
    var hub = card.getAttribute("data-hub");
    var status = card.querySelector(".verse-group-status");
    var pending = action === "add-links" ? "Adding…" : action === "undo-links" ? "Undoing…" : "Saving…";
    if (status) status.textContent = pending;
    var body = { action: action, hub: hub };
    if (action === "save") {
      var form = card.querySelector(".verse-group-form");
      if (form) {
        var data = new FormData(form);
        body.title = String(data.get("title") || "");
        body.description = String(data.get("description") || "");
      }
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
        if (status) status.textContent = payload.error || "Could not save.";
        return;
      }
      try {
        sessionStorage.setItem(OPEN_KEY, "1");
        sessionStorage.setItem(FLASH_KEY, JSON.stringify({ hub: hub, message: payload.status || "Saved." }));
      } catch (err) {}
      location.reload();
    }).catch(function () {
      card.removeAttribute("data-busy");
      if (status) status.textContent = "Could not save.";
    });
  }
})();`;
}

function linksHtml(group: VerseGroupView): string {
  const undo = `<button type="button" class="verse-group-undo"${group.undoReady ? "" : " hidden"}>Undo last cross-links</button>`;
  if (!group.missingCount) {
    return `<div class="verse-group-links"><p class="verse-group-links-done">Cross-links already connect this web.</p>${undo}</div>`;
  }
  const items = group.missingPairs
    .map((pair) => `<li>${escapeHtml(pair.fromLabel)} → ${escapeHtml(pair.toLabel)}</li>`)
    .join("");
  const cap =
    group.missingCount > group.missingPairs.length
      ? `<p class="verse-group-cap">Showing ${group.missingPairs.length} of ${group.missingCount} missing cross-links.</p>`
      : "";
  return `<div class="verse-group-links">
  <button type="button" class="verse-group-fill" aria-expanded="false">Add the cross-links in this web</button>
  <div class="verse-group-preview" hidden>
    <p>These cross-links are not in the web yet. Nothing is added until you confirm. One-way links you already made stay as they are.</p>
    ${cap}
    <ul class="verse-group-pair-list">${items}</ul>
    <button type="button" class="verse-group-fill-confirm">Add these links</button>
  </div>
  ${undo}
</div>`;
}

function verseGroupsIcon(): string {
  return `<svg class="verse-groups-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5" fill="currentColor"/><circle cx="12.6" cy="3.4" r="1.5" fill="currentColor"/><circle cx="12.6" cy="12.6" r="1.5" fill="currentColor"/><path d="M4.6 7.3 11.1 4.1M4.6 8.7 11.1 11.8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`;
}
