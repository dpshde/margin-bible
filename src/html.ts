export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const MOON_PATH =
  "M233.54 142.23a8 8 0 0 0-8-2a88.08 88.08 0 0 1-109.8-109.8a8 8 0 0 0-10-10a104.84 104.84 0 0 0-52.91 37A104 104 0 0 0 136 224a103.1 103.1 0 0 0 62.52-20.88a104.84 104.84 0 0 0 37-52.91a8 8 0 0 0-1.98-7.98m-44.64 48.11A88 88 0 0 1 65.66 67.11a89 89 0 0 1 31.4-26A106 106 0 0 0 96 56a104.11 104.11 0 0 0 104 104a106 106 0 0 0 14.92-1.06a89 89 0 0 1-26.02 31.4";
const SUN_PATH =
  "M120 40V16a8 8 0 0 1 16 0v24a8 8 0 0 1-16 0m72 88a64 64 0 1 1-64-64a64.07 64.07 0 0 1 64 64m-16 0a48 48 0 1 0-48 48a48.05 48.05 0 0 0 48-48M58.34 69.66a8 8 0 0 0 11.32-11.32l-16-16a8 8 0 0 0-11.32 11.32Zm0 116.68l-16 16a8 8 0 0 0 11.32 11.32l16-16a8 8 0 0 0-11.32-11.32M192 72a8 8 0 0 0 5.66-2.34l16-16a8 8 0 0 0-11.32-11.32l-16 16A8 8 0 0 0 192 72m5.66 114.34a8 8 0 0 0-11.32 11.32l16 16a8 8 0 0 0 11.32-11.32ZM48 128a8 8 0 0 0-8-8H16a8 8 0 0 0 0 16h24a8 8 0 0 0 8-8m80 80a8 8 0 0 0-8 8v24a8 8 0 0 0 16 0v-24a8 8 0 0 0-8-8m112-88h-24a8 8 0 0 0 0 16h24a8 8 0 0 0 0-16";

function themeIcon(path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
}

/** Header control. The moon shows in light mode; the sun shows in dark mode. */
export function themeToggleHtml(): string {
  return `<button type="button" class="icon-btn theme-toggle" data-theme-toggle aria-pressed="false" aria-label="Switch to dark mode" title="Dark mode"><span class="theme-icon theme-icon-moon">${themeIcon(MOON_PATH)}</span><span class="theme-icon theme-icon-sun">${themeIcon(SUN_PATH)}</span></button>`;
}

function themeBootScript(): string {
  return `<script>
(function () {
  try {
    if (localStorage.getItem("margin_reader_hint_v1") === "1") {
      document.documentElement.setAttribute("data-reader-hint", "off");
    }
    document.documentElement.classList.add("spotlight-on");
  } catch (err) {}
  var key = "margin_theme";
  function preferred() {
    try {
      var saved = localStorage.getItem(key);
      if (saved === "dark" || saved === "light") return saved;
    } catch (err) {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#1c1917" : "#f6f5f2");
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    var dark = theme === "dark";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.title = dark ? "Light mode" : "Dark mode";
  }
  apply(preferred());
  document.addEventListener("DOMContentLoaded", function () { apply(preferred()); });
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var btn = target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(key, next); } catch (err) {}
    apply(next);
  });
})();
</script>`;
}

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
  <meta name="theme-color" content="#f6f5f2">
  ${themeBootScript()}
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Margin">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='2' fill='%231c1917'/%3E%3Cpath d='M4 4.5h8M4 8h8M4 11.5h5' stroke='%23f6f5f2' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --tap: 2.75rem; /* 44px at 16px root — Apple HIG / Material minimum */
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --chrome-sticky: calc(2.75rem + var(--safe-top));
      --paper: #f6f5f2;
      --paper-raised: #ffffff;
      --ink: #1c1917;
      --ink-soft: #44403c;
      --muted: #78716c;
      --faint: #a8a29e;
      --line: color-mix(in srgb, var(--ink) 12%, transparent);
      --fill: color-mix(in srgb, var(--ink) 5%, transparent);
      --sel-rail: color-mix(in srgb, var(--ink) 18%, transparent);
      --sel-rail-open: color-mix(in srgb, var(--ink) 42%, transparent);
      --page-max: 36em;
      --read-size: 1.2rem;
      --read-leading: 1.65;
      --verse-gutter: 1.65rem;
      --verse-gutter-gap: .55rem;
      --verse-inset: .7rem;
      /* How far the selection stroke sits left of the verse content edge.
         0 keeps it on the padding edge (left of the number on phones).
         Desktop sets this to the hanging number column so the stroke is outside the number. */
      --verse-rail-gap: 0rem;
      --read: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif;
      --sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
      --head: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --paper: #1c1917;
      --paper-raised: #292524;
      --ink: #f5f5f4;
      --ink-soft: #d6d3d1;
      --muted: #a8a29e;
      --faint: #78716c;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); }
    body {
      min-height: 100dvh;
      padding-bottom: var(--safe-bottom);
    }
    /* Desktop: kill macOS rubber-band overscroll. Keep default on touch so pull-to-refresh works. */
    @media (pointer: fine) {
      html, body { overscroll-behavior: none; }
    }
    button, a, .icon-btn, .expand-btn, .tray-bookmark, .tray-attach, .tray-clear, .tray-close, .att-remove, .obullet, .verse-press, .suggest button, .search-result, .search-fab, .topbar-title-btn, .chapter-grid-cell {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    a { color: inherit; }
    button, input { font: inherit; color: inherit; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); border: 0;
    }
    .topbar {
      position: sticky; top: 0; z-index: 7;
      display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
      gap: .5rem;
      padding:
        calc(.35rem + var(--safe-top))
        calc(.75rem + env(safe-area-inset-right, 0px))
        .35rem
        calc(.75rem + env(safe-area-inset-left, 0px));
      min-height: calc(var(--tap) + var(--safe-top));
      background: color-mix(in srgb, var(--paper) 92%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
    }
    .topbar-side { display: flex; align-items: center; gap: .25rem; }
    .topbar-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0; }
    /* Notes keeps the title in the center track. Side tracks size to their icons, so the title never slides under the moon. */
    .topbar.topbar-notes {
      grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
    }
    .topbar.topbar-notes .topbar-side { justify-self: start; }
    .topbar.topbar-notes .topbar-title {
      justify-self: center;
      width: max-content;
      max-width: 100%;
    }
    .topbar.topbar-notes .topbar-title-btn { width: max-content; max-width: 100%; }
    .topbar.topbar-notes .topbar-actions { justify-self: end; }
    .topbar-title {
      display: flex; align-items: center; justify-content: center;
      margin: 0; font-family: var(--head); font-size: 1.05rem; font-weight: 600;
      text-align: center; letter-spacing: -.01em; min-width: 0;
    }
    .topbar-title-btn {
      appearance: none; -webkit-appearance: none;
      display: block; width: auto; max-width: 100%; min-width: 0; flex: 0 1 auto;
      min-height: var(--tap);
      margin: 0; padding: .2rem .4rem;
      border: 0; border-radius: .45rem;
      background: transparent;
      font: inherit; color: inherit; text-align: inherit;
      cursor: pointer;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .topbar-title-btn:hover,
    .topbar-title-btn:focus-visible,
    .topbar-title-btn[aria-expanded="true"] { background: var(--fill); }
    .topbar-title-btn:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--ink) 28%, transparent);
      outline-offset: 1px;
    }
    /* Chapter bookmark sits with the title so it reads as chapter-scoped, not a toolbar action.
       Keep the leading inset of a 44px icon button; shave the trailing side so the glyph
       sits a little closer to the chapter name. */
    .icon-btn.topbar-chapter-mark {
      flex: none;
      width: auto;
      padding-inline-start: calc((var(--tap) - 1.1rem) / 2);
      padding-inline-end: .4rem;
    }
    .is-grid-open .topbar { z-index: 45; }
    .icon-btn {
      appearance: none; display: inline-flex; align-items: center; justify-content: center;
      width: var(--tap); height: var(--tap); padding: 0; border: 0; border-radius: .55rem;
      background: transparent; color: var(--ink-soft); cursor: pointer; text-decoration: none;
    }
    .icon-btn.is-on { color: var(--ink); background: var(--fill); }
    /* Persisted note/bookmark state is carried by the filled glyph, not a selected square. */
    [data-state-icon] { position: relative; }
    [data-state-icon] .state-icon-filled { display: none; }
    [data-state-icon][data-state-on="true"] .state-icon-outline { display: none; }
    [data-state-icon][data-state-on="true"] .state-icon-filled { display: block; }
    .icon-btn[data-state-icon].is-on,
    .icon-btn[data-state-icon]:focus-visible,
    .tray-bookmark[data-state-icon].is-on,
    .tray-bookmark[data-state-icon]:focus-visible {
      color: var(--ink); background: transparent;
    }
    .icon-btn[data-state-icon]:focus-visible,
    .tray-bookmark[data-state-icon]:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--ink) 28%, transparent);
      outline-offset: 2px;
    }
    .icon-btn[data-state-icon][data-state-on="true"]:hover,
    .tray-bookmark[data-state-icon][data-state-on="true"]:hover { background: transparent; }
    /* Header bookmark stays flat. Hover must not paint a fill, border, or shadow. */
    .icon-btn.topbar-chapter-mark:hover {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .icon-btn:hover { color: var(--ink); background: var(--fill); }
      .icon-btn.topbar-chapter-mark:hover {
        background: transparent;
        border-color: transparent;
        box-shadow: none;
      }
    }
    .icon-btn:focus-visible { color: var(--ink); background: var(--fill); }
    .icon-btn:disabled { opacity: .35; cursor: default; }
    .icon-btn svg { display: block; width: 1.1rem; height: 1.1rem; }
    .theme-toggle .theme-icon { display: inline-flex; }
    .theme-toggle .theme-icon-sun { display: none; }
    html[data-theme="dark"] .theme-toggle .theme-icon-moon { display: none; }
    html[data-theme="dark"] .theme-toggle .theme-icon-sun { display: inline-flex; }
    /* expand-btn also has .icon-btn — match profile/bookmark icon-only density (no bordered pill). */
    .expand-btn .expand-label { display: none; }
    .expand-btn.is-on {
      color: var(--ink); background: var(--fill);
    }
    .expand-btn:disabled { opacity: .45; cursor: default; color: var(--ink-soft); }
    .expand-btn:disabled:hover { color: var(--ink-soft); background: transparent; }
    .expand-btn .expand-icon {
      position: relative; display: block; width: 1.1rem; height: 1.1rem; flex-shrink: 0;
    }
    .expand-btn .expand-icon svg {
      display: block; width: 1.1rem; height: 1.1rem;
      transition: opacity 180ms ease, transform 180ms ease;
    }
    .expand-btn .expand-icon-out {
      opacity: 1; transform: rotate(0deg) scale(1);
    }
    .expand-btn .expand-icon-in {
      position: absolute; inset: 0;
      opacity: 0; transform: rotate(-30deg) scale(.88);
    }
    .expand-btn.is-on .expand-icon-out {
      opacity: 0; transform: rotate(30deg) scale(.88);
    }
    .expand-btn.is-on .expand-icon-in {
      opacity: 1; transform: rotate(0deg) scale(1);
    }
    main.reader, .notes-main, footer.site {
      width: min(var(--page-max), calc(100% - 2rem));
      margin: 0 auto;
    }
    .jump {
      display: block; margin: .85rem 0 .35rem;
      position: relative; z-index: 5;
    }
    /* Open results sit above the verse rail (which drops to 4) and under the header (7). */
    .jump.is-open,
    .jump:has(.suggest:not([hidden])) { z-index: 6; }
    #reader-hint { position: relative; z-index: 5; }
    .jump-field {
      position: relative; min-width: 0;
      display: flex; flex-direction: column;
      border: 1px solid var(--line); border-radius: .55rem;
      background: var(--paper-raised);
    }
    .jump.is-open .jump-field,
    .jump:has(.suggest:not([hidden])) .jump-field {
      border-color: color-mix(in srgb, var(--ink) 28%, transparent);
    }
    .jump-input-row {
      position: relative; display: flex; align-items: center; min-width: 0;
    }
    .jump input[type="search"] {
      flex: 1; min-width: 0; width: 100%; font: inherit; font-size: 16px;
      padding: .5rem 2rem .5rem .7rem;
      border: 0; border-radius: .55rem; background: transparent;
      outline: none; box-shadow: none;
      -webkit-appearance: none; appearance: none;
    }
    .jump input[type="search"]::-webkit-search-decoration,
    .jump input[type="search"]::-webkit-search-cancel-button,
    .jump input[type="search"]::-webkit-search-results-button,
    .jump input[type="search"]::-webkit-search-results-decoration {
      -webkit-appearance: none; appearance: none; display: none;
    }
    .jump input[type="search"]:focus,
    .jump input[type="search"]:focus-visible {
      outline: none; box-shadow: none;
    }
    .jump-clear {
      position: absolute; right: .2rem; top: 50%; transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.7rem; height: 1.7rem; padding: 0; margin: 0;
      border: 0; border-radius: 999px; cursor: pointer;
      color: var(--faint); background: transparent;
    }
    .jump-clear[hidden] { display: none; }
    @media (hover: hover) and (pointer: fine) {
      .jump-clear:hover { color: var(--ink-soft); background: var(--fill); }
    }
    .jump-clear:focus-visible { color: var(--ink); background: var(--fill); outline: none; }
    .jump-clear svg { display: block; width: .9rem; height: .9rem; }
    .suggest {
      --list-radius: .55rem;
      list-style: none; margin: 0; padding: 0;
      position: absolute; left: 0; right: 0; top: 100%; z-index: 6;
      background: var(--paper-raised);
      border: 1px solid var(--line); border-top: 0;
      border-radius: 0 0 var(--list-radius) var(--list-radius);
      overflow: hidden;
    }
    /* Jump field owns the outer border — suggest flows attached inside, not a floating box. */
    .jump-field .suggest {
      position: relative; left: auto; right: auto; top: auto;
      background: transparent;
      border: 0; border-top: 1px solid var(--line);
      border-radius: 0 0 var(--list-radius) var(--list-radius);
      max-height: min(24rem, calc(100dvh - var(--chrome-sticky) - 5.75rem - var(--safe-bottom) - var(--keyboard-inset, 0px)));
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }
    .suggest-scripture {
      white-space: normal; height: auto; line-height: 1.35;
    }
    .suggest-ref {
      display: block; color: var(--ink);
      font-variant-numeric: lining-nums;
    }
    .suggest-text {
      display: block; max-height: calc(1.35em * 3); overflow: hidden;
      margin-top: .15rem;
      color: var(--faint); font-size: .78rem; line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .suggest-skeleton {
      margin: 0; padding: .5rem .8rem; pointer-events: none;
    }
    .suggest-skeleton + .suggest-skeleton { box-shadow: inset 0 1px var(--line); }
    .suggest-skeleton-ref,
    .suggest-skeleton-text {
      display: block; border-radius: .2rem;
      background: color-mix(in srgb, var(--ink) 12%, transparent);
    }
    .suggest-skeleton-ref { height: .72rem; width: 4.6rem; }
    .suggest-skeleton-text { height: .62rem; width: 88%; margin-top: .4rem; }
    .suggest-skeleton:nth-child(2) .suggest-skeleton-ref { width: 6.2rem; }
    .suggest-skeleton:nth-child(2) .suggest-skeleton-text { width: 74%; }
    .suggest-skeleton:nth-child(3) .suggest-skeleton-ref { width: 3.8rem; }
    .suggest-skeleton:nth-child(3) .suggest-skeleton-text { width: 92%; }
    .suggest-skeleton:nth-child(4) .suggest-skeleton-ref { width: 5.4rem; }
    .suggest-skeleton:nth-child(4) .suggest-skeleton-text { width: 66%; }
    @media (prefers-reduced-motion: no-preference) {
      .suggest-skeleton-ref,
      .suggest-skeleton-text { animation: suggest-skeleton 1.1s ease-in-out infinite; }
    }
    @keyframes suggest-skeleton {
      50% { opacity: .45; }
    }
    .suggest[hidden] { display: none; }
    .suggest li { margin: 0; }
    .suggest-hint {
      padding: .4rem .8rem .5rem;
      font-size: .78rem; line-height: 1.3;
      color: var(--faint); pointer-events: none;
      border-top: 1px solid var(--line);
    }
    .suggest li:first-child.suggest-hint { border-top: 0; }
    .suggest button {
      appearance: none; -webkit-appearance: none;
      display: block; width: 100%; margin: 0; text-align: left;
      padding: .5rem .8rem; border: 0; border-radius: 0;
      background: transparent; cursor: pointer;
      font-size: .92rem; color: var(--ink-soft);
      outline: none; box-shadow: none;
    }
    .suggest li + li:not(.suggest-hint) button { box-shadow: inset 0 1px var(--line); }
    .suggest button:hover,
    .suggest button:focus,
    .suggest button:focus-visible,
    .suggest li[aria-selected="true"] button {
      background: color-mix(in srgb, var(--ink) 8%, var(--paper-raised));
      color: var(--ink);
      outline: none; box-shadow: none;
    }
    .suggest li:last-child button {
      border-radius: 0 0 var(--list-radius) var(--list-radius);
    }
    .search-modal {
      position: fixed; z-index: 50;
      left: 0; right: 0;
      top: var(--vv-top, 0px);
      height: var(--vv-height, 100dvh);
      display: flex; align-items: center; justify-content: center;
      box-sizing: border-box;
      --search-gutter: max(.75rem, calc(.75rem + var(--safe-top)), calc(.75rem + var(--safe-bottom)));
      padding:
        var(--search-gutter)
        calc(.75rem + env(safe-area-inset-right, 0px))
        var(--search-gutter)
        calc(.75rem + env(safe-area-inset-left, 0px));
    }
    .search-modal[hidden] { display: none; }
    .search-modal-backdrop {
      position: absolute; inset: 0;
      margin: 0; padding: 0; border: 0; cursor: pointer;
      /* scripture.ar.io: stone-900/90, and #000000e6 in dark, with backdrop-blur-sm. */
      background: rgb(28 25 23 / 0.9);
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }
    html[data-theme="dark"] .search-modal-backdrop { background: #000000e6; }
    .search-modal-panel {
      position: relative; z-index: 1;
      width: min(36rem, 100%);
      max-height: 100%;
      display: flex; flex-direction: column; min-height: 0;
      background: var(--paper-raised);
      border-radius: .5rem; overflow: hidden;
    }
    html[data-theme="dark"] .search-modal-panel { background: #1b1917; }
    .search-modal-form {
      display: flex; flex-direction: column; min-height: 0;
      width: 100%; max-height: 100%;
    }
    .search-modal-bar {
      position: relative;
      display: flex; align-items: center; flex: 0 0 auto;
      gap: .55rem;
      min-width: 0;
      box-sizing: border-box;
      padding: 12px 14px;
    }
    .search-modal-form:has(.search-modal-list:not([hidden])) .search-modal-bar::after {
      content: "";
      position: absolute; left: 0; right: 0; bottom: 0;
      height: 1px;
      background: color-mix(in srgb, var(--ink) 14%, transparent);
      pointer-events: none;
    }
    .search-modal-icon {
      flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
      width: 18px; height: 18px;
      color: #a8a29e;
    }
    .search-modal-icon svg { display: block; width: 18px; height: 18px; }
    html[data-theme="dark"] .search-modal-icon { color: #78716c; }
    .search-modal-results {
      display: flex; flex-direction: column;
      flex: 1 1 auto; min-height: 0; width: 100%;
    }
    .search-modal-form input[type="search"] {
      flex: 1 1 auto; align-self: center;
      box-sizing: border-box;
      width: 100%; height: auto; min-height: 0; margin: 0;
      padding: .25rem 0;
      border: 0; border-radius: 0; background: transparent; outline: none;
      font: inherit; font-size: 1.125rem; line-height: 1.25; font-weight: 400;
      color: var(--ink);
      -webkit-appearance: none; appearance: none;
    }
    .search-modal-form input[type="search"]::placeholder { color: #a8a29e; opacity: 1; }
    html[data-theme="dark"] .search-modal-form input[type="search"]::placeholder { color: #78716c; }
    .search-modal-form input[type="search"]::-webkit-search-decoration,
    .search-modal-form input[type="search"]::-webkit-search-cancel-button,
    .search-modal-form input[type="search"]::-webkit-search-results-button,
    .search-modal-form input[type="search"]::-webkit-search-results-decoration {
      -webkit-appearance: none; appearance: none; display: none;
    }
    .search-modal-list {
      list-style: none; margin: 0; padding: 0; min-height: 0;
      flex: 1 1 auto;
      overflow-x: hidden; overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .search-modal-list::-webkit-scrollbar {
      display: none; width: 0; height: 0;
    }
    .search-modal-list[hidden] { display: none; }
    .search-unavailable {
      margin: 0; padding: .85rem 1rem;
      color: #a8a29e;
      font-size: .92rem; line-height: 1.35; text-align: left;
    }
    html[data-theme="dark"] .search-unavailable { color: #78716c; }
    .search-modal-footer {
      display: none;
      flex: 0 0 auto;
      margin: 0;
      padding: .45rem 1rem .7rem;
      border: 0; background: transparent;
      color: #a8a29e;
      font-size: .75rem; font-weight: 400; line-height: 1.2;
      text-align: left;
      pointer-events: none; user-select: none;
    }
    html[data-theme="dark"] .search-modal-footer { color: #78716c; }
    .search-modal-form:has(.search-modal-list:not([hidden])) .search-modal-footer { display: block; }
    .search-modal-form:has(.search-modal-list.is-passage) .search-modal-footer { display: none; }
    .search-history {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex: 0 0 auto; min-width: 0;
      /* Same inset as the search bar, so the clock and the first recent query line up with the search icon. */
      padding: 0 14px 12px;
    }
    .search-history[hidden] { display: none; }
    .search-history-label {
      display: inline-flex;
      align-items: center;
      flex: none;
      margin: 0;
      color: #a8a29e;
      line-height: 0;
    }
    .search-history-chips { flex: 1 1 auto; min-width: 0; }
    html[data-theme="dark"] .search-history-label { color: #78716c; }
    .search-suggest {
      display: none;
      flex: 0 0 auto; min-width: 0;
      /* First chip lines up with the search icon. Right and bottom match the bar's 14px / 12px inset. */
      padding: 0 14px 12px;
    }
    .search-suggest[hidden] { display: none; }
    .search-suggest-chips {
      --chip-fade: 28px;
      display: flex; flex-wrap: nowrap; gap: .3rem;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      -webkit-mask-size: 100% 100%;
      mask-size: 100% 100%;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
    }
    .search-suggest-chips::-webkit-scrollbar { display: none; width: 0; height: 0; }
    .search-suggest-chips.is-fade-right {
      -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - var(--chip-fade)), transparent 100%);
      mask-image: linear-gradient(to right, #000 0, #000 calc(100% - var(--chip-fade)), transparent 100%);
    }
    .search-suggest-chips.is-fade-left {
      -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--chip-fade), #000 100%);
      mask-image: linear-gradient(to right, transparent 0, #000 var(--chip-fade), #000 100%);
    }
    .search-suggest-chips.is-fade-left.is-fade-right {
      -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--chip-fade), #000 calc(100% - var(--chip-fade)), transparent 100%);
      mask-image: linear-gradient(to right, transparent 0, #000 var(--chip-fade), #000 calc(100% - var(--chip-fade)), transparent 100%);
    }
    .search-suggest-chip {
      flex: 0 0 auto; white-space: nowrap;
      margin: 0; padding: .2rem .5rem;
      border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
      border-radius: 999px;
      background: transparent;
      box-shadow: none; outline: none;
      color: #a8a29e;
      font: inherit; font-size: .82rem; line-height: 1.2;
      cursor: pointer;
    }
    html[data-theme="dark"] .search-suggest-chip { color: #78716c; }
    .search-suggest-chip:hover,
    .search-suggest-chip:focus-visible {
      color: var(--ink-soft);
      background: color-mix(in srgb, var(--ink) 6%, transparent);
      box-shadow: none; outline: none;
    }
    .search-result {
      display: block; width: 100%; margin: 0; text-align: left;
      min-height: var(--tap);
      padding: .85rem 1rem; border: 0; border-radius: 0;
      background: transparent; cursor: pointer; color: var(--ink);
    }
    .search-cancel { display: none; }
    .search-testament-segments { display: none; }
    .search-modal-list li + li .search-result { box-shadow: inset 0 1px var(--line); }
    .search-result.is-selected,
    .search-result:hover,
    .search-result:focus-visible {
      outline: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .search-result.is-selected,
      .search-result:hover,
      .search-result:focus-visible {
        background: color-mix(in srgb, var(--ink) 8%, var(--paper-raised));
      }
    }
    .search-result:active {
      background: color-mix(in srgb, var(--ink) 8%, var(--paper-raised));
    }
    .search-result-ref {
      display: block;
      font-size: .78rem; font-weight: 650; letter-spacing: .04em;
      text-transform: uppercase; color: var(--ink-soft);
    }
    .search-result-text {
      display: block; max-height: calc(1.35em * 3); overflow: hidden;
      margin-top: .28rem;
      font-family: var(--read); font-size: 1.02rem; line-height: 1.35;
      color: var(--ink); overflow-wrap: anywhere;
      text-wrap: pretty;
      hanging-punctuation: allow-end last;
    }
    .search-result-passage {
      display: block;
      font-size: .92rem; line-height: 1.35;
      color: var(--ink);
    }
    .search-modal-list .suggest-hint { padding: .55rem 1rem .7rem; }
    .search-modal-list > li:first-child.suggest-hint { border-top: 0; }
    .search-mark {
      background: none; color: #ea580c; font-weight: 600;
    }
    html[data-theme="dark"] .search-mark { color: #fb923c; }
    html.search-modal-open { overflow: hidden; }
    /* scripture.ar.io translation <select>: text-xs, weight 500, no border, 4px radius, chevron. */
    .search-testament { flex: 0 0 auto; min-width: 0; }
    .search-testament-btn {
      display: inline-flex; align-items: center; justify-content: flex-start;
      box-sizing: border-box; height: 20px; margin: 0;
      padding: .125rem 1.75rem .125rem .375rem;
      border: 0; border-radius: .25rem; outline: none;
      background-color: transparent;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right .25rem center;
      background-size: 1.25em 1.25em;
      color: #44403c;
      font: inherit; font-size: .75rem; font-weight: 500; line-height: 1rem;
      cursor: pointer; appearance: none; -webkit-appearance: none;
      touch-action: manipulation;
    }
    html[data-theme="dark"] .search-testament-btn {
      background-color: transparent;
      color: #d6d3d1;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a8a29e' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    }
    .search-testament-btn:focus-visible { outline: none; }
    .search-testament-more {
      display: none;
      flex: 0 0 auto; align-items: center; justify-content: center;
      width: 32px; height: 32px; margin: 0; padding: 8px;
      border: 0; border-radius: .25rem; background: transparent;
      color: #57534e; cursor: pointer; touch-action: manipulation;
    }
    html[data-theme="dark"] .search-testament-more { color: #a8a29e; }
    .search-testament-more svg { display: block; width: 16px; height: 16px; }
    .search-testament-sheet { display: none; }
    .search-testament-menu {
      position: fixed; z-index: 5;
      min-width: 5.5rem; margin: 0; padding: 0;
      overflow: hidden;
      border: 1px solid #e7e5e4; border-radius: .25rem;
      background: #fff; color: #44403c;
      box-shadow: 0 .5rem 1.25rem rgb(28 25 23 / .16);
    }
    .search-testament-menu[hidden] { display: none; }
    html[data-theme="dark"] .search-testament-menu {
      background: #1c1917; color: #d6d3d1; border-color: #44403c;
    }
    .search-testament-option {
      display: flex; align-items: center; gap: .4rem;
      box-sizing: border-box; width: 100%; margin: 0; padding: .3rem .7rem;
      border: 0; border-radius: 0; background: transparent; color: inherit;
      font: inherit; font-size: .75rem; font-weight: 500; line-height: 1rem;
      text-align: left; cursor: pointer; touch-action: manipulation;
    }
    .search-testament-menu .search-testament-option:first-child { border-radius: .2rem .2rem 0 0; }
    .search-testament-menu .search-testament-option:last-child { border-radius: 0 0 .2rem .2rem; }
    .search-testament-check { width: .8em; opacity: 0; font-size: .75rem; }
    .search-testament-option.is-selected .search-testament-check { opacity: 1; }
    @media (hover: hover) and (pointer: fine) {
      .search-testament-option.is-active { background: #f5f5f4; }
      html[data-theme="dark"] .search-testament-option.is-active { background: #292524; }
    }
    .search-testament-option:active { background: #f5f5f4; }
    html[data-theme="dark"] .search-testament-option:active { background: #292524; }
    .search-fab { display: none; }
    @media (max-width: 767px) {
      .search-fab {
        display: inline-flex; align-items: center; justify-content: center;
        position: fixed; z-index: 51;
        width: 3.4rem; height: 3.4rem; padding: 0;
        border: 0; border-radius: 999px; cursor: pointer;
        background: #292524; color: #e7e5e4;
        right: calc(14px + env(safe-area-inset-right, 0px));
        bottom: calc(14px + env(safe-area-inset-bottom, 0px));
        box-shadow: 0 .35rem 1rem color-mix(in srgb, #000 28%, transparent);
        transition: opacity 160ms ease, visibility 0s linear;
      }
      .search-fab svg { display: block; width: 28px; height: 28px; }
      html[data-theme="dark"] .search-fab {
        background: #57534e;
        color: #fafaf9;
        box-shadow:
          0 0 0 1px color-mix(in srgb, #fafaf9 46%, transparent),
          0 .35rem 1rem rgb(0 0 0 / .5);
      }
      html { --phone-tab-h: calc(3.35rem + env(safe-area-inset-bottom, 0px)); }
      .search-fab {
        bottom: calc(14px + var(--phone-tab-h));
      }
      html.search-modal-open .search-fab,
      html.is-grid-open .search-fab,
      html.spotlight-on:has(.verse:is(.is-open, .is-span)) .search-fab {
        opacity: 0; visibility: hidden; pointer-events: none;
        transition: opacity 160ms ease, visibility 0s linear 160ms;
      }
    }
    @media (max-width: 767px) {
      .search-modal {
        top: 0; right: 0; bottom: 0; left: 0;
        width: auto; height: auto; margin: 0;
        align-items: stretch; justify-content: flex-start;
        padding: 0;
      }
      .search-modal-panel {
        position: absolute; inset: 0;
        width: auto; height: auto; max-width: none; max-height: none;
        margin: 0; border: 0; border-radius: 0;
        background: var(--paper-raised);
        background-clip: border-box;
        box-shadow: none;
      }
      .search-modal-form:has(.search-modal-list:not([hidden])) .search-modal-bar::after {
        content: none;
      }
      .search-modal-form { height: 100%; max-height: none; }
      .search-modal-bar {
        touch-action: none;
        padding:
          calc(12px + env(safe-area-inset-top, 0px))
          calc(14px + env(safe-area-inset-right, 0px))
          12px
          calc(14px + env(safe-area-inset-left, 0px));
        background: var(--paper-raised);
      }
      html[data-theme="dark"] .search-modal-bar { background: #1b1917; }
      .search-modal-results {
        overflow-x: hidden; overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .search-modal-results::-webkit-scrollbar { display: none; width: 0; height: 0; }
      .search-modal-list { flex: none; overflow: visible; }
      .search-history,
      .search-suggest {
        padding:
          0
          calc(14px + env(safe-area-inset-right, 0px))
          12px
          calc(14px + env(safe-area-inset-left, 0px));
      }
      .search-suggest-chips {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .search-suggest-chips::-webkit-scrollbar { display: none; width: 0; height: 0; }
      .search-suggest-chip { flex: 0 0 auto; }
      .search-testament-desktop { display: none; }
      .search-testament-more { display: none; }
      .search-cancel {
        display: inline-flex; align-items: center; justify-content: center;
        flex: none; min-width: var(--tap); min-height: var(--tap);
        margin: 0; padding: 0 .35rem;
        border: 0; border-radius: .55rem; background: transparent;
        color: var(--ink); cursor: pointer;
        font: inherit; font-size: .95rem; font-weight: 650;
      }
      .search-cancel:focus-visible { outline: 2px solid color-mix(in srgb, var(--ink) 28%, transparent); outline-offset: 1px; }
      .search-testament-segments {
        display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: .35rem;
        padding:
          0
          calc(14px + env(safe-area-inset-right, 0px))
          12px
          calc(14px + env(safe-area-inset-left, 0px));
      }
      .search-testament-segment {
        min-height: var(--tap);
        margin: 0; padding: 0 .4rem;
        border: 1px solid var(--line); border-radius: .7rem;
        background: transparent; color: var(--ink-soft);
        font: inherit; font-size: .95rem; font-weight: 650;
        cursor: pointer;
      }
      .search-testament-segment.is-selected {
        background: var(--ink); color: var(--paper); border-color: var(--ink);
      }
      .search-suggest-chip { min-height: var(--tap); padding: 0 .9rem; }
      .search-testament-sheet:not([hidden]) {
        display: flex; align-items: center; justify-content: space-between;
        flex: 0 0 auto;
        padding: .5rem .75rem;
        background: #f5f5f4;
        border-top: 1px solid #e7e5e4;
      }
      html[data-theme="dark"] .search-testament-sheet:not([hidden]) {
        background: #292524;
        border-top-color: #44403c;
      }
      .search-testament-sheet-label {
        color: #57534e;
        font-size: .75rem; font-weight: 500; line-height: 1rem;
      }
      html[data-theme="dark"] .search-testament-sheet-label { color: #a8a29e; }
      .search-testament-sheet .search-testament-btn {
        height: auto;
        padding: .25rem 1.75rem .25rem .5rem;
        border: 1px solid #e7e5e4;
        background-color: #fff;
        color: #44403c;
      }
      html[data-theme="dark"] .search-testament-sheet .search-testament-btn {
        border-color: #44403c;
        background-color: #1c1917;
        color: #d6d3d1;
      }
      .search-testament-sheet .search-testament-btn:focus-visible {
        outline: 1px solid #a8a29e;
        outline-offset: 1px;
      }
    }
    .section-head {
      margin: 1.4rem 0 .55rem calc(var(--verse-gutter) + var(--verse-gutter-gap));
      font-family: var(--head); font-size: 1.2rem; font-weight: 600; line-height: 1.25;
    }
    .section-head:first-child { margin-top: .35rem; }
    .chapter { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    .verse {
      display: block; position: relative;
      padding: 0 0 0 var(--verse-inset);
      margin: .15rem 0;
    }
    .verse.has-note,
    .verse.is-open,
    .verse.is-span { border-left: 0; }
    /* Stroke is left of the verse number. The line itself does not move,
       so a desktop column can stay flush with the jump field. */
    .verse.has-note::before,
    .verse.is-open::before,
    .verse.is-span::before {
      content: "";
      position: absolute;
      left: calc(-1 * var(--verse-rail-gap));
      top: 0; bottom: 0; width: 2px;
      background: var(--sel-rail);
      pointer-events: none;
    }
    .verse.is-open::before,
    .verse.is-span::before {
      background: var(--sel-rail-open);
    }
    /* The range rail is the left border. A narrow hit strip on the stroke, short of the verse number. */
    .verse-range-rail {
      position: absolute;
      z-index: 2;
      left: calc(-1 * var(--verse-rail-gap) - .12rem); top: 0; bottom: 0;
      width: .55rem;
      margin: 0; padding: 0; border: 0;
      background: transparent;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .verse-range-rail:focus,
    .verse-range-rail:focus-visible { outline: none; }
    /* Rails-ish selection chrome: adjacent marked/open/span verse rows share one rail.
       The normal .verse margin is retained at the ends of a run, but removed
       between selected rows so the accent does not look like broken segments —
       including when a tray sits under the first verse of a multi-verse range. */
    .verse:is(.has-note, .is-open, .is-span):has(+ .verse:is(.has-note, .is-open, .is-span)) { margin-bottom: 0; }
    .verse:is(.has-note, .is-open, .is-span) + .verse:is(.has-note, .is-open, .is-span) { margin-top: 0; }
    .verse-press {
      display: grid; grid-template-columns: var(--verse-gutter) 1fr;
      gap: var(--verse-gutter-gap); width: 100%;
      appearance: none; border: 0; background: transparent; text-align: left; cursor: pointer;
      padding: .12rem 0; touch-action: manipulation;
    }
    .verse, .note-tray, .chapter-tray, .tray-head, .otext {
      scroll-margin-top: calc(var(--chrome-sticky) + 0.75rem);
      scroll-margin-bottom: calc(1.25rem + var(--safe-bottom));
    }
    .verse-press:focus, .verse-press:focus-visible { outline: none; }
    .vnum {
      font-variant-numeric: lining-nums;
      color: #57534e;
      font-size: .92em; font-weight: 650; padding-top: .28rem; text-align: right;
    }
    html[data-theme="dark"] .vnum { color: #e7e5e4; }
    .verse.is-open .vnum, .verse.is-span .vnum, .verse.has-note .vnum { color: var(--ink-soft); }
    .vtext {
      font-family: var(--read); font-size: var(--read-size); line-height: var(--read-leading);
      color: var(--ink);
    }
    /* Spotlight is always on. A selected verse, or every verse in a selected
       range, stays fully readable. Everything else in the chapter drops to 0.3.
       Header, jump, and the reader hint are not in this list. A section heading
       stays up only when it introduces a verse inside the selection. */
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .verse,
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .section-head,
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .chapter-note-rail,
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .pager {
      opacity: 0.3;
    }
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .verse:is(.is-open, .is-span),
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .verse.reader-rail-active-verse,
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .section-head:has(+ .verse:is(.is-open, .is-span)),
    html.spotlight-on:has(.verse:is(.is-open, .is-span)) .chapter-note-rail:focus-within {
      opacity: 1;
      position: relative;
      z-index: 5;
    }
    /* Screen-edge fade. A fixed paper wash over the dimmed chapter, not over
       the focused verse (that row is lifted above this layer). Desktop fades
       toward every edge. Mobile keeps the top clear, under the sticky header,
       and fades downward. */
    html.spotlight-on:has(.verse:is(.is-open, .is-span))::before {
      content: "";
      position: fixed; z-index: 4; inset: 0;
      pointer-events: none;
      background: radial-gradient(
        ellipse 58% 50% at 50% 46%,
        transparent 34%,
        var(--paper) 100%
      );
    }
    @media (max-width: 767px) {
      html.spotlight-on:has(.verse:is(.is-open, .is-span))::before {
        background: linear-gradient(
          to bottom,
          transparent 0%,
          transparent 42%,
          var(--paper) 100%
        );
      }
    }
    html.spotlight-on #chapter { overflow-anchor: none; }
    /* Verse rail: a fixed right-edge scrubber. It sits above the spotlight wash
       (z-index 4) and the lifted verse (z-index 5), and under the sticky header
       (z-index 7) and the chapter grid (z-index 40). Idle ticks stay quiet.
       Dragging grows a wave around the current tick and shows the verse number.
       The window scrollbar is hidden while the rail is on the page. Scrolling stays. */
    html:has(.reader-verse-rail),
    html:has(.reader-verse-rail) body {
      scrollbar-width: none;
    }
    html:has(.reader-verse-rail)::-webkit-scrollbar,
    html:has(.reader-verse-rail) body::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    .reader-verse-rail {
      position: fixed;
      top: calc(var(--chrome-sticky) + 6px);
      right: env(safe-area-inset-right, 0px);
      bottom: calc(18px + var(--safe-bottom));
      z-index: 6;
      width: 32px;
      padding-left: 18px;
      border-radius: 6px 0 0 6px;
      background: transparent;
      opacity: 0.56;
      cursor: ns-resize;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      transition: width 0.16s ease, padding-left 0.16s ease, opacity 0.16s ease, background-color 0.16s ease;
    }
    .reader-verse-rail.visible,
    .reader-verse-rail:hover,
    .reader-verse-rail:focus-visible {
      width: 36px;
      padding-left: 12px;
      opacity: 1;
      outline: none;
    }
    .reader-verse-rail.dragging {
      width: 38px;
      padding-left: 8px;
      opacity: 1;
      background: transparent;
      outline: none;
    }
    .reader-verse-rail.is-native-scroll { pointer-events: none; }
    .reader-verse-rail.is-selection-hidden { opacity: 0; pointer-events: none; }
    /* touch-action stays none on phones too. manipulation lets the browser take the
       pan and then drop it on this fixed rail, so the chapter never moves. The touch
       handler scrolls by the finger delta instead. Mouse scrubbing is unchanged. */
    /* An open search list paints with the jump field and covers this rail.
       Nested :has() is split so one unsupported selector cannot drop the rule. */
    main:has(.jump.is-open) .reader-verse-rail { z-index: 4; }
    .reader-verse-rail-checkpoints {
      position: absolute;
      inset: 20px -1px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-end;
      pointer-events: none;
    }
    .reader-verse-rail-dot {
      width: 15px;
      height: 2px;
      flex: 0 0 2px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ink) 45%, transparent);
      opacity: 0.42;
      transition: width 0.12s ease, background-color 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
    }
    .reader-verse-rail:hover .reader-verse-rail-dot,
    .reader-verse-rail:focus-visible .reader-verse-rail-dot,
    .reader-verse-rail.visible .reader-verse-rail-dot,
    .reader-verse-rail.dragging .reader-verse-rail-dot { opacity: 0.48; }
    .reader-verse-rail.dragging .reader-verse-rail-dot {
      background: color-mix(in srgb, var(--ink) 36%, transparent);
      opacity: 0.82;
    }
    .reader-verse-rail-dot.current,
    .reader-verse-rail.dragging .reader-verse-rail-dot.current {
      width: 42px;
      background: var(--ink);
      opacity: 1;
      box-shadow: 0 0 10px color-mix(in srgb, var(--ink) 28%, transparent);
    }
    .reader-verse-rail-dot.wave-3,
    .reader-verse-rail.dragging .reader-verse-rail-dot.wave-3 {
      width: 16px;
      background: color-mix(in srgb, var(--ink) 56%, transparent);
      opacity: 0.54;
    }
    .reader-verse-rail-dot.wave-2,
    .reader-verse-rail.dragging .reader-verse-rail-dot.wave-2 {
      width: 17px;
      background: color-mix(in srgb, var(--ink) 64%, transparent);
      opacity: 0.62;
    }
    .reader-verse-rail-dot.wave-1,
    .reader-verse-rail.dragging .reader-verse-rail-dot.wave-1 {
      width: 21px;
      background: color-mix(in srgb, var(--ink) 74%, transparent);
      opacity: 0.74;
    }
    .verse.reader-rail-active-verse .vtext {
      font-weight: 450;
      text-shadow: 0.028em 0 0 currentColor, -0.028em 0 0 currentColor;
    }
    .reader-verse-modal {
      position: fixed;
      left: 50%;
      top: 50%;
      z-index: 30;
      min-width: 96px;
      height: 96px;
      padding: 0 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
      border-radius: 18px;
      background: color-mix(in srgb, var(--paper) 96%, transparent);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 30px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0;
      text-align: center;
      box-shadow: 0 10px 30px color-mix(in srgb, var(--ink) 22%, transparent);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      pointer-events: none;
    }
    .reader-verse-modal[hidden] { display: none; }
    /* Phone rail is a leaner strip. Desktop scrub width stays 32px. The hit target stays wide enough to tap.
       The rail is fixed to the viewport edge. On a centered desktop column it does not overlap the text,
       so the chapter keeps the jump field's right edge. Narrow screens still inset for the rail. */
    @media (max-width: 767px) {
      .reader-verse-rail { width: 28px; padding-left: 16px; }
      .reader-verse-rail.visible,
      .reader-verse-rail:hover,
      .reader-verse-rail:focus-visible { width: 30px; padding-left: 12px; }
      .reader-verse-rail.dragging { width: 32px; padding-left: 8px; }
      .reader-verse-rail-dot { width: 8px; }
      .reader-verse-rail-dot.current,
      .reader-verse-rail.dragging .reader-verse-rail-dot.current { width: 14px; }
      .reader-verse-rail-dot.wave-3,
      .reader-verse-rail.dragging .reader-verse-rail-dot.wave-3 { width: 9px; }
      .reader-verse-rail-dot.wave-2,
      .reader-verse-rail.dragging .reader-verse-rail-dot.wave-2 { width: 10px; }
      .reader-verse-rail-dot.wave-1,
      .reader-verse-rail.dragging .reader-verse-rail-dot.wave-1 { width: 12px; }
    }
    /* Desktop reading column matches the jump field: same left and right edges.
       Verse numbers hang in the margin so they don't shorten the line.
       The selection stroke sits at the outside of that number column
       (border, then number, then text) and does not shift the line. */
    @media (min-width: 656px) {
      .section-head { margin-left: 0; margin-right: 0; }
      .verse { padding-left: 0; }
      .reader, .verse, .chapter {
        --verse-rail-gap: calc(var(--verse-gutter) + var(--verse-gutter-gap));
      }
      .verse-press {
        width: calc(100% + var(--verse-gutter) + var(--verse-gutter-gap));
        margin-left: calc(-1 * (var(--verse-gutter) + var(--verse-gutter-gap)));
      }
    }
    .note-tray, .chapter-tray {
      position: relative;
      margin-left: calc(var(--verse-gutter) + var(--verse-gutter-gap));
      padding: .12rem 0 .28rem;
    }
    @media (min-width: 656px) {
      .note-tray { margin-left: 0; }
    }
    .chapter-note-rail {
      margin: 0 0 .55rem;
    }
    .chapter-note-peek {
      display: flex; align-items: center; justify-content: center;
      width: 100%; min-height: 1.1rem; margin: 0 0 .35rem; padding: .42rem 0;
      border: 0; background: transparent; cursor: pointer;
      border-radius: .45rem;
    }
    .chapter-note-peek-bar {
      display: block; width: min(100%, 12rem); height: 2px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ink) 7%, transparent);
      opacity: .55;
      transform: scaleX(1);
      transition: background .15s ease, opacity .15s ease, transform .15s ease;
    }
    .chapter-note-rail[data-has-note="true"] .chapter-note-peek-bar {
      background: color-mix(in srgb, var(--ink) 14%, transparent);
      opacity: .85;
      transform: scaleX(1.08);
    }
    @media (hover: hover) and (pointer: fine) {
      .chapter-note-peek:hover .chapter-note-peek-bar {
        background: color-mix(in srgb, var(--ink) 28%, transparent);
        opacity: 1;
        transform: scaleX(1.15);
      }
    }
    .chapter-note-peek:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--ink) 28%, transparent);
      outline-offset: 2px;
    }
    .chapter-note-peek:focus-visible .chapter-note-peek-bar {
      background: color-mix(in srgb, var(--ink) 32%, transparent);
      opacity: 1;
    }
    .chapter-note-rail.is-open .chapter-note-peek { display: none; }
    .chapter-tray {
      /* Chapter note follows the jump field's full main-column width. */
      margin: 0 0 .35rem;
      /* Keep air vertical without shrinking the shared left/right edges. */
      padding: .28rem 0 .42rem;
    }
    .chapter-tray .outliner {
      padding: .42rem 0;
    }
    .note-tray[hidden], .chapter-tray[hidden] { display: none !important; }
    .note-tray.is-tray-anim {
      display: grid !important;
      overflow: hidden;
      will-change: grid-template-rows, opacity;
    }
    .note-tray.is-tray-anim > .note-tray-clip {
      overflow: hidden;
      min-height: 0;
    }
    /* Air after an open tray only when the next verse is outside the marked/open run.
       Inside a multi-verse selection/covering range the left rail must stay contiguous. */
    .verse:has(.note-tray:not([hidden])) + .verse:not(.has-note):not(.is-open):not(.is-span) { margin-top: .15rem; }
    .verse:has(.note-tray:not([hidden])) + .verse:is(.has-note, .is-open, .is-span) { margin-top: 0; }
    /* Back-to-back open trays (stacked under one verse or adjacent selected verses). */
    .note-tray:not([hidden]) + .note-tray:not([hidden]) {
      padding-top: 0;
      margin-top: 0;
    }
    .verse:is(.is-open, .is-span):has(.note-tray:not([hidden])) + .verse:is(.is-open, .is-span) .note-tray:not([hidden]) {
      padding-top: 0.02rem;
    }
    .verse:is(.is-open, .is-span):has(.note-tray:not([hidden])) .note-tray:not([hidden]) {
      padding-bottom: .12rem;
    }
    .tray-head {
      position: sticky;
      bottom: 0;
      z-index: 3;
      display: block;
      margin: .12rem 0 0;
      padding: .05rem 0;
      background: color-mix(in srgb, var(--paper) 94%, transparent);
      backdrop-filter: blur(8px);
    }
    .tray-toolbar {
      display: flex; align-items: center; gap: .35rem;
      min-width: 0;
    }
    .tray-meta {
      display: inline-flex; align-items: baseline; gap: .4rem;
      flex: 1; min-width: 0;
    }
    .tray-label { margin: 0; font-size: .78rem; color: var(--faint); text-decoration: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (hover: hover) and (pointer: fine) {
      a.tray-label:hover { color: var(--ink); }
    }
    a.tray-label:focus-visible { color: var(--ink); }
    .tray-status {
      margin: 0; font-size: .72rem; color: var(--muted); line-height: 1.2;
      flex-shrink: 0;
    }
    .tray-status:empty { display: none; }
    .tray-clear, .tray-close {
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: var(--faint); padding: .15rem;
      border: 0; background: transparent; cursor: pointer;
      min-width: var(--tap); min-height: var(--tap);
    }
    @media (hover: hover) and (pointer: fine) {
      .tray-clear:hover, .tray-close:hover { color: var(--ink); }
    }
    .tray-clear:focus-visible, .tray-close:focus-visible { color: var(--ink); background: var(--fill); border-radius: .45rem; }
    .tray-clear svg, .tray-close svg, .tray-attach svg, .tray-bookmark svg { display: block; width: 1.05rem; height: 1.05rem; }
    .outliner {
      display: block; width: 100%;
      border: 1px solid var(--line); background: var(--paper-raised);
      border-radius: .65rem; padding: .22rem 0; min-height: 0;
    }
    .outliner:focus-within {
      border-color: color-mix(in srgb, var(--ink) 28%, transparent);
    }
    /* Attachments: one tight chip strip under the editor (not a tall separate band). */
    .note-tray:has(.att-board:not([hidden])),
    .chapter-tray:has(.att-board:not([hidden])) {
      padding: .12rem 0 .28rem;
    }
    .note-tray:has(.att-board:not([hidden])) .outliner,
    .chapter-tray:has(.att-board:not([hidden])) .outliner {
      padding: .22rem 0;
    }
    .note-tray:has(.att-board:not([hidden])) .att-board,
    .chapter-tray:has(.att-board:not([hidden])) .att-board {
      margin-top: .16rem;
      gap: .3rem;
    }
    .note-tray:has(.att-board:not([hidden])) .tray-head,
    .chapter-tray:has(.att-board:not([hidden])) .tray-head {
      margin-top: .1rem;
      padding: .05rem 0;
    }
    .oblock {
      display: flex; align-items: flex-start; gap: .4rem;
      padding: 0 .7rem 0 calc(.55rem + (var(--depth, 0) * 1.15rem));
    }
    .obullet {
      position: relative;
      width: 1.35rem; min-width: 1.35rem; height: 1.55em;
      margin: 0; flex-shrink: 0; cursor: pointer;
      background: transparent; border-radius: .4rem;
    }
    .obullet::after {
      content: "";
      position: absolute; left: 50%; top: 50%;
      width: .34rem; height: .34rem; margin: -.17rem 0 0 -.17rem;
      border-radius: 50%; background: transparent;
    }
    .oblock.is-bullet .obullet::after { background: var(--faint); opacity: .75; }
    .oblock:not(.is-bullet):focus-within .obullet::after {
      background: var(--faint); opacity: .35;
    }
    @media (hover: hover) and (pointer: fine) {
      .oblock:not(.is-bullet):hover .obullet::after { background: var(--faint); opacity: .35; }
    }
    .otext {
      flex: 1; min-width: 0; min-height: 1.55em; line-height: 1.55;
      padding: 0; white-space: pre-wrap; word-break: break-word; caret-color: var(--ink);
      outline: none; border: 0; font-size: 16px;
    }
    .pager {
      display: flex; justify-content: space-between; gap: 1rem;
      margin: 1.5rem 0 2rem; font-size: .95rem;
    }
    .pager a { text-decoration: none; color: var(--ink-soft); }
    .pager a:hover { color: var(--ink); }
    /* Bookmarks: icon + soft wash — distinct from THIS WEEK, not a heavy card. */
    .bookmarks-view {
      margin: 0 0 0.5rem;
      padding: .35rem .45rem .4rem;
      border-radius: .55rem;
      background: var(--fill);
    }
    .bookmarks-view > summary {
      display: flex; align-items: center; justify-content: space-between; gap: .5rem;
      margin: 0 0 .15rem; padding: 0;
      min-height: var(--tap);
      cursor: pointer; list-style: none;
      font: 700 .7rem/1.3 var(--sans);
      letter-spacing: .08em; text-transform: uppercase;
      color: var(--ink-soft);
    }
    .bookmarks-view > summary::-webkit-details-marker { display: none; }
    .bookmarks-summary-label { display: inline-flex; align-items: center; gap: .35rem; }
    .bookmarks-summary-icon { display: block; width: .9rem; height: .9rem; color: var(--ink-soft); }
    .bookmarks-view > summary::after { content: "＋"; display: inline-flex; align-items: center; justify-content: center; min-width: var(--tap); min-height: var(--tap); padding: .1rem .2rem; border-radius: .35rem; color: var(--faint); font-size: .9rem; font-weight: 400; }
    .bookmarks-view[open] > summary::after { content: "－"; }
    .bookmarks-view > summary:focus-visible { outline: 2px solid var(--sel-rail-open); outline-offset: -2px; }
    .bookmarks-panel { padding: 0; margin: 0; border: 0; }
    .bookmarks-panel .empty { margin: .2rem 0 0; }
    /* Sheet chrome stays out of the desktop accordion. Phone tabs show the list full screen. */
    .notes-sheet-backdrop,
    .notes-sheet-handle,
    .notes-sheet-title { display: none; }
    .phone-tabs { display: none; }
    @media (max-width: 767px) {
      .phone-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 36;
        width: 100%;
        margin: 0;
        padding: 0 0 env(safe-area-inset-bottom, 0px);
        border-top: 1px solid var(--line);
        background: var(--paper);
      }
      .phone-tab {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        min-height: 3.35rem;
        margin: 0;
        padding: .4rem .2rem;
        border: 0;
        background: transparent;
        color: var(--faint);
        text-decoration: none;
      }
      .phone-tab-icon { display: block; width: 1.6rem; height: 1.6rem; }
      .phone-tab[aria-current="page"] {
        color: var(--ink);
        box-shadow: inset 0 2px 0 var(--ink);
      }
      .bookmarks-view > summary { display: none; }
      .bookmarks-view > summary::after,
      .bookmarks-view[open] > summary::after {
        content: none;
        display: none;
      }
      .bookmarks-view { display: none; }
      html[data-phone-tab="bookmarks"] .notes-main,
      html[data-phone-tab="groups"] .notes-main {
        width: 100%;
        max-width: none;
        margin: 0;
        padding-left: 0;
        padding-right: 0;
      }
      html[data-phone-tab="bookmarks"] #bookmarks-view,
      html[data-phone-tab="groups"] #verse-groups-view {
        display: block;
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 0;
        border-radius: 0;
        background: var(--paper);
      }
      html[data-phone-tab="bookmarks"] .notes-main > .jump,
      html[data-phone-tab="bookmarks"] .notes-main > .starter-chips,
      html[data-phone-tab="bookmarks"] .notes-main > #notes-mount,
      html[data-phone-tab="groups"] .notes-main > .jump,
      html[data-phone-tab="groups"] .notes-main > .starter-chips,
      html[data-phone-tab="groups"] .notes-main > #notes-mount {
        display: none;
      }
      .notes-sheet,
      .notes-sheet-panel {
        position: static;
        left: auto;
        right: auto;
        bottom: auto;
        width: 100%;
        max-width: none;
        height: auto;
        max-height: none;
        margin: 0;
        padding: 0;
        padding-left: 0;
        padding-right: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        background: transparent;
        overflow: visible;
      }
      html[data-phone-tab="bookmarks"] .bookmarks-panel,
      html[data-phone-tab="groups"] .bookmarks-panel {
        padding: .75rem 1rem calc(1rem + var(--phone-tab-h, 0px));
      }
      html[data-phone-tab="bookmarks"] .bookmarks-panel:has(> .empty),
      html[data-phone-tab="groups"] .bookmarks-panel:has(> .empty) {
        position: fixed;
        z-index: 2;
        left: 0;
        right: 0;
        top: calc(.7rem + var(--tap) + var(--safe-top) + 1px);
        bottom: var(--phone-tab-h);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0 1.5rem;
        background: var(--paper);
      }
      html[data-phone-tab="bookmarks"] .bookmarks-panel > .empty,
      html[data-phone-tab="groups"] .bookmarks-panel > .empty {
        margin: 0;
        text-align: center;
      }
    }
    /* Keep the soft-wash bookmark container calm; rows do not grow a second frame. */
    .bookmarks-panel .note-list .note-row { border-radius: .35rem; }
    @media (hover: hover) and (pointer: fine) {
      .bookmarks-panel .note-list .note-row:hover,
      .bookmarks-panel .note-list .note-row:focus-visible {
        background: var(--paper-raised);
      }
    }
    /* Topics use the same soft-wash control as Bookmarks.
       A topic collapses to a title and a count, then opens onto its chips. */
    .verse-group { margin: 0; }
    /* Open title, description, and the first chip share this left gutter. */
    #verse-groups-view { --topic-inset: .8rem; }
    .verse-group > summary.note-row {
      width: 100%;
      cursor: pointer;
      list-style: none;
    }
    .verse-group > summary.note-row::-webkit-details-marker { display: none; }
    .verse-group > summary.note-row::marker { content: ""; }
    /* Closed, the row stays a bookmark. Open, ink and paper invert.
       Padding and baseline stay the closed row's, so the title does not jump. */
    .verse-group-hub { display: none; }
    .verse-group[open] > summary.note-row {
      background: var(--ink);
      color: var(--paper);
    }
    .verse-group[open] > summary .note-row-title,
    .verse-group[open] > summary .note-row-excerpt {
      color: var(--paper);
    }
    /* Open fill wins over bookmark hover, focus, and the collapse wash. */
    .bookmarks-panel .note-list .verse-group[open] > summary.note-row,
    .bookmarks-panel .note-list .verse-group[open] > summary.note-row:hover,
    .bookmarks-panel .note-list .verse-group[open] > summary.note-row:focus,
    .bookmarks-panel .note-list .verse-group[open] > summary.note-row:focus-visible {
      background: var(--ink);
      color: var(--paper);
      outline: none;
    }
    .bookmarks-panel .note-list .verse-group[open] > summary .note-row-title,
    .bookmarks-panel .note-list .verse-group[open] > summary .note-row-excerpt {
      color: var(--paper);
    }
    /* Collapse leaves the pointer on the summary. Hold the closed look
       until the pointer actually leaves and comes back. Never while open. */
    .bookmarks-panel .note-list .verse-group.is-collapsed-hover:not([open]) > summary.note-row,
    .bookmarks-panel .note-list .verse-group.is-collapsed-hover:not([open]) > summary.note-row:hover,
    .bookmarks-panel .note-list .verse-group.is-collapsed-hover:not([open]) > summary.note-row:focus,
    .bookmarks-panel .note-list .verse-group.is-collapsed-hover:not([open]) > summary.note-row:focus-visible {
      background: transparent;
      outline: none;
    }
    .verse-group-form { display: flex; flex-direction: column; gap: .4rem; margin: 0; padding: .4rem .55rem .25rem; }
    .verse-group-fields {
      display: flex;
      flex-direction: column;
      gap: .15rem;
      margin: 0 0 0 .2rem;
      padding: 0 0 .05rem .5rem;
      border-left: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    }
    .verse-group-form input,
    .verse-group-form textarea {
      width: 100%;
      margin: 0;
      padding: .45rem .55rem;
      border: 0;
      border-radius: .4rem;
      background: transparent;
      color: var(--ink);
      font: 400 1rem/1.4 var(--sans);
    }
    .verse-group > summary .note-row-title {
      flex: 0 1 auto;
      min-width: 0;
    }
    .verse-group > summary .note-row-excerpt { display: none; }
    /* A collapsed topic is a title and a count, not a note line. */
    .verse-group > summary.verse-group-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: .85rem;
      width: 100%;
      padding: .85rem .8rem;
      border-radius: .45rem;
    }
    .verse-group-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .verse-group-head {
      display: flex;
      align-items: center;
      gap: .15rem;
      min-width: 0;
    }
    .verse-group > summary.verse-group-row .note-row-title {
      flex: 0 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .verse-group-head .verse-group-title-actions {
      order: 0;
      margin-left: 0;
    }
    .verse-count-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      min-width: 1.55rem;
      height: 1.35rem;
      padding: 0 .42rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ink) 12%, transparent);
      color: var(--ink);
      font: 700 .72rem/1 var(--sans);
      font-variant-numeric: tabular-nums;
    }
    .verse-group[open] > summary .verse-count-pill {
      background: color-mix(in srgb, var(--paper) 18%, transparent);
      color: var(--paper);
    }
    .verse-group:not([open]) > summary .verse-group-title-actions { display: none; }
    @media (max-width: 767px) {
      html[data-phone-tab="groups"] #verse-groups-view { background: var(--fill); }
      #verse-groups-view .note-list {
        display: flex;
        flex-direction: column;
        gap: .4rem;
      }
      #verse-groups-view .verse-group {
        border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
        border-radius: .75rem;
        background: var(--paper);
        overflow: hidden;
      }
      #verse-groups-view .verse-group > summary.verse-group-row {
        min-height: 2.55rem;
        padding: .45rem .8rem;
        border-radius: 0;
      }
      #verse-groups-view .verse-group[open] > summary.verse-group-row {
        padding: .28rem .55rem .28rem var(--topic-inset);
      }
      #verse-groups-view .verse-group[open] > summary .verse-group-title-edit,
      #verse-groups-view .verse-group[open] > summary .tray-attach {
        width: 1.9rem;
        height: 1.9rem;
        min-width: 1.9rem;
        min-height: 1.9rem;
      }
      #verse-groups-view .verse-group-form {
        gap: .28rem;
        padding: .4rem .65rem .5rem var(--topic-inset);
      }
      #verse-groups-view .verse-group-fields {
        margin: 0;
        padding: 0;
        border-left: 0;
      }
      #verse-groups-view .verse-group-form textarea.verse-group-description {
        height: 1.85rem;
        min-height: 0;
        max-height: 1.85rem;
        padding: .22rem .45rem .22rem 0;
        resize: none;
        overflow: hidden;
        white-space: nowrap;
        font-size: .82rem;
        line-height: 1.3;
      }
    }
    .verse-group-title-actions {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      flex: none;
      order: 3;
      margin-left: auto;
    }
    .verse-group-title-edit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      align-self: center;
      width: var(--tap);
      height: var(--tap);
      min-width: var(--tap);
      min-height: var(--tap);
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--ink-soft);
      cursor: pointer;
      line-height: 0;
    }
    .verse-group > summary .tray-attach {
      color: var(--ink-soft);
      width: var(--tap);
      height: var(--tap);
      min-width: var(--tap);
      min-height: var(--tap);
    }
    .verse-group > summary .verse-group-title-edit svg,
    .verse-group > summary .tray-attach svg {
      width: 1.05rem;
      height: 1.05rem;
    }
    .verse-group[open] > summary .verse-group-title-edit,
    .verse-group[open] > summary .tray-attach { color: var(--paper); }
    .verse-group[open] > summary .verse-group-title-edit:hover,
    .verse-group[open] > summary .tray-attach:hover,
    .verse-group[open] > summary .verse-group-title-edit:focus-visible,
    .verse-group[open] > summary .tray-attach:focus-visible {
      color: var(--paper);
      background: color-mix(in srgb, var(--paper) 16%, transparent);
    }
    .verse-group > summary .note-row-title[contenteditable="true"] {
      cursor: text;
      outline: none;
      min-width: 1.5rem;
      border-radius: .2rem;
    }
    .verse-group > summary .note-row-title[contenteditable="true"]:focus {
      overflow: visible;
      text-overflow: clip;
      background: color-mix(in srgb, var(--paper) 14%, transparent);
    }
    .verse-group > summary .note-row-title[contenteditable="true"]:empty::before {
      content: "Title";
      font-weight: 500;
      color: color-mix(in srgb, var(--paper) 62%, transparent);
    }
    .verse-group.is-drop {
      outline: 2px solid var(--ink);
      outline-offset: -2px;
    }
    .verse-group .att-item.is-dragging { opacity: .4; }
    .verse-group-drag-ghost {
      position: fixed;
      z-index: 80;
      margin: 0;
      padding: .15rem .55rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--paper-raised);
      color: var(--ink);
      font: 600 .78rem/1.25 var(--sans);
      pointer-events: none;
      transform: translate(-50%, -140%);
      box-shadow: 0 .25rem .8rem color-mix(in srgb, var(--ink) 18%, transparent);
    }
    .verse-group-form textarea.verse-group-description {
      display: block;
      resize: vertical;
      overflow: auto;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      outline: none;
      appearance: none;
      color: var(--ink);
      font: 400 .88rem/1.35 var(--sans);
      padding: .32rem .5rem;
      min-height: 1.85rem;
    }
    .verse-group-form textarea.verse-group-description::placeholder {
      color: var(--faint);
      font-weight: 400;
      font-size: .78rem;
    }
    .verse-group-verses {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .25rem .3rem;
      padding-left: .15rem;
    }
    .verse-group-verses .att-board { flex: 1 1 auto; margin: 0; gap: .28rem; }
    .verse-group-status { margin: 0; color: var(--muted); font-size: .8rem; font-weight: 400; }
    .verse-group-status:empty { display: none; }
    /* Light side rails make each week one frame, not a stack of cards.
       Weeks stack flush so the rails do not break into a borderless gap. */
    .note-week {
      margin: 0;
      border-left: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
      border-right: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    }
    .note-week:last-child { margin-bottom: 1.5rem; }
    /* Filled inverted bars make THIS WEEK / LAST WEEK / OLDER read as dividers. */
    .note-week-label {
      display: flex; align-items: center;
      margin: 0; padding: .35rem .55rem;
      border-radius: 0;
      border-bottom: 1px solid color-mix(in srgb, var(--paper) 28%, transparent);
      background: var(--ink); color: var(--paper);
      font: 700 .7rem/1.3 var(--sans);
      letter-spacing: .08em; text-transform: uppercase;
    }
    .note-list { list-style: none; padding: 0; margin: 0; }
    .note-list .note-row {
      display: flex; align-items: baseline; gap: .5rem; min-width: 0;
      padding: .95rem .7rem; overflow: hidden; text-decoration: none;
      border-radius: .4rem;
    }
    /* Week rows sit inside square rails; keep fills flush with the frame. */
    .note-week .note-row {
      padding-inline: .65rem;
      border-radius: 0;
    }
    .note-bundle {
      position: relative;
      display: flex; flex-wrap: wrap; align-items: center;
      column-gap: .7rem; row-gap: .4rem;
      padding: .7rem .65rem;
    }
    .note-bundle.note-row-chapter { min-height: var(--tap); padding: .95rem .65rem; }
    /* The row itself opens the chapter. The name sits above it and opens the chapter note. */
    .note-bundle-open { position: absolute; inset: 0; z-index: 0; }
    .note-bundle-name,
    .note-bundle-verse { position: relative; z-index: 1; }
    .note-bundle .note-row-excerpt { position: relative; z-index: 0; pointer-events: none; }
    .note-bundle:has(.note-bundle-open:hover) { background: var(--fill); }
    .note-bundle-name {
      flex: none; text-decoration: none;
      font-weight: 700; font-size: .95rem; letter-spacing: -.015em; color: var(--ink);
    }
    .note-bundle-verses {
      display: flex; flex: 1 1 8rem; flex-wrap: wrap; align-items: center;
      gap: .28rem; min-width: 0;
    }
    .note-bundle-verse {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.85rem; min-height: 1.7rem; padding: .12rem .42rem;
      border: 1px solid var(--line); border-radius: .35rem;
      background: var(--paper-raised);
      text-decoration: none; white-space: nowrap;
      font-weight: 600; font-size: .84rem; font-variant-numeric: tabular-nums;
      line-height: 1.2; color: var(--ink);
    }
    .note-list .note-row:hover, .note-list .note-row:focus-visible { background: var(--fill); }
    .note-bundle-name:hover, .note-bundle-name:focus-visible { color: var(--ink); }
    .note-bundle-verse:hover, .note-bundle-verse:focus-visible {
      border-color: color-mix(in srgb, var(--ink) 28%, transparent);
      background: var(--fill); color: var(--ink);
    }
    .note-bundle-name:focus-visible, .note-bundle-verse:focus-visible {
      outline: 2px solid var(--sel-rail-open); outline-offset: 2px;
    }
    .note-list .note-row:focus-visible { outline: 2px solid var(--sel-rail-open); outline-offset: -2px; }
    .note-row-title {
      flex: none; max-width: 100%;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-weight: 700; font-size: .95rem;
      letter-spacing: -.015em; color: var(--ink);
    }
    .note-row-excerpt {
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: var(--faint); font-size: .78rem; font-weight: 400;
    }
    .empty { color: var(--muted); font-size: .92rem; }
    .starter-chips {
      display: flex; flex-wrap: wrap; gap: .3rem;
      margin: 0 0 .85rem;
    }
    .starter-chip {
      display: inline-flex; align-items: center;
      min-height: 1.7rem; padding: .1rem .55rem;
      border-radius: 999px; text-decoration: none;
      font-size: .72rem; font-weight: 600;
      color: var(--ink-soft); background: var(--fill);
      border: 1px solid var(--line);
    }
    .starter-chip:hover, .starter-chip:focus-visible { color: var(--ink); background: var(--paper-raised); }
    footer.site { padding-bottom: 2rem; color: var(--muted); font: .8rem/1.4 var(--sans); }
    .hint {
      margin: 0 0 1rem; padding: .65rem .8rem;
      border: 1px dashed var(--line); border-radius: .65rem;
      color: var(--muted); font-size: .82rem; line-height: 1.45;
      cursor: pointer;
    }
    .hint[hidden],
    html[data-reader-hint="off"] #reader-hint { display: none !important; }
    .auth-chip {
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--tap); height: var(--tap); margin: 0; padding: 0;
      border-radius: .55rem; text-decoration: none;
      font-size: .72rem; font-weight: 600; letter-spacing: .01em;
      color: var(--ink-soft); background: transparent;
    }
    .auth-chip svg { display: block; width: 1.1rem; height: 1.1rem; }
    @media (hover: hover) and (pointer: fine) {
      .auth-chip:hover { color: var(--ink); background: var(--fill); }
    }
    .auth-chip:focus-visible { color: var(--ink); background: var(--fill); }
    .auth-chip.is-in { color: var(--ink-soft); }
    .menu-item {
      appearance: none; -webkit-appearance: none;
      min-height: var(--tap); width: 100%; padding: 0 .75rem;
      margin: 0; border: 0; background: transparent; border-radius: 0;
      font-family: var(--sans); font-size: .92rem; text-align: left; text-decoration: none;
      color: var(--ink-soft); cursor: pointer;
      display: inline-flex; align-items: center; gap: .55rem;
      box-sizing: border-box;
    }
    .menu-item:hover, .menu-item:focus, .menu-item:focus-visible {
      background: color-mix(in srgb, var(--ink) 8%, var(--paper-raised));
      color: var(--ink); outline: none;
    }
    .menu-item.export-link svg { display: block; flex-shrink: 0; }
    .auth-export {
      display: inline-flex; align-items: center; gap: .55rem;
      margin: 0; padding: .15rem 0;
      min-height: 2.25rem; width: auto;
      border-radius: .45rem; text-decoration: none;
      color: var(--ink-soft); font-size: .92rem; font-weight: 600;
    }
    .auth-export:hover, .auth-export:focus-visible { color: var(--ink); background: var(--fill); }
    .auth-export svg { display: block; flex-shrink: 0; }
    .auth-main {
      width: min(24rem, calc(100% - 2rem));
      margin: 1.25rem auto 2rem;
    }
    .auth-lead, .auth-hint, .auth-status, .auth-notice { color: var(--muted); font-size: .9rem; line-height: 1.45; }
    .auth-error { color: #9f1239; background: #fff1f2; border: 1px solid #fecdd3; border-radius: .55rem; padding: .55rem .7rem; font-size: .88rem; }
    .auth-notice { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: .55rem; padding: .55rem .7rem; }
    html[data-theme="dark"] .auth-error { color: #fecdd3; background: #4c0519; border-color: #9f1239; }
    html[data-theme="dark"] .auth-notice { color: #bbf7d0; background: #052e16; border-color: #166534; }
    .auth-form { display: grid; gap: .45rem; margin: 1rem 0; }
    .auth-form label { font-size: .82rem; font-weight: 600; color: var(--ink-soft); }
    .auth-form .optional { font-weight: 400; color: var(--faint); }
    .auth-form input {
      font: inherit; padding: .6rem .7rem;
      border: 1px solid var(--line); border-radius: .55rem; background: var(--paper-raised);
    }
    .auth-form button {
      appearance: none; border: 0; border-radius: .55rem; margin-top: .35rem;
      padding: .65rem .85rem; background: var(--ink); color: var(--paper); cursor: pointer; font-weight: 600;
    }
    .auth-form button.auth-secondary { background: transparent; color: var(--ink-soft); border: 1px solid var(--line); }
    .passkey-btn {
      appearance: none; width: 100%; margin: .85rem 0 0;
      border-radius: .55rem; padding: .6rem .85rem;
      background: transparent; color: var(--ink-soft); border: 1px solid var(--line);
      cursor: pointer; font: inherit; font-weight: 600;
    }
    .passkey-account { margin: 0; padding: 0; border: 0; }
    .passkey-kicker {
      margin: 0;
      color: var(--muted); font-size: .9rem; font-weight: 500; line-height: 1.4;
    }
    .passkey-list {
      list-style: none; margin: 0; padding: 0;
    }
    .passkey-list li {
      display: flex; align-items: center; gap: .55rem;
      min-height: 2.25rem; margin: 0; padding: 0;
      border: 0; border-radius: 0; background: transparent;
      color: var(--ink); font-size: .95rem; font-weight: 400;
    }
    .passkey-list li + li { margin-top: .15rem; }
    .passkey-name {
      flex: none; max-width: 55%;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-weight: 600;
    }
    .passkey-when {
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: var(--faint); font-size: .82rem; font-weight: 400;
    }
    .passkey-list form { margin: 0 0 0 auto; flex: none; }
    .passkey-remove {
      appearance: none; display: inline-flex; align-items: center; justify-content: center;
      border: 0; border-radius: .45rem; background: transparent; cursor: pointer;
      color: #e11d48; min-width: 2.25rem; min-height: 2.25rem; padding: 0;
    }
    .passkey-remove svg { display: block; width: 1.05rem; height: 1.05rem; }
    .passkey-remove:hover, .passkey-remove:focus-visible {
      color: #be123c; background: color-mix(in srgb, currentColor 12%, transparent);
    }
    html[data-theme="dark"] .passkey-remove { color: #fb7185; }
    html[data-theme="dark"] .passkey-remove:hover,
    html[data-theme="dark"] .passkey-remove:focus-visible { color: #fda4af; }
    .auth-signed {
      display: grid; gap: .7rem;
      margin: .35rem 0 1.25rem;
    }
    .auth-status-card {
      display: grid; gap: 1.15rem;
      margin: 0; padding: 1rem 1rem .95rem;
      border: 1px solid var(--line); border-radius: .75rem;
      background: var(--paper-raised);
    }
    .auth-status-card .auth-status { margin: 0; color: var(--ink-soft); }
    .auth-status-card .auth-hint { margin: 0; font-size: .78rem; }
    .auth-status-card .auth-form {
      margin: 0; padding: 0; border: 0;
    }
    .auth-status-card .auth-form button {
      background: var(--ink); color: var(--paper); border: 0; width: 100%; margin-top: 0;
    }
    .auth-switch {
      border: 1px solid var(--line); border-radius: .65rem;
      background: transparent; padding: 0 .9rem;
    }
    .auth-switch[open] { padding-bottom: .85rem; }
    .auth-switch > summary {
      display: flex; align-items: center; justify-content: space-between; gap: .75rem;
      cursor: pointer; list-style: none;
      min-height: 2.75rem; padding: 0;
      font-size: .82rem; font-weight: 600; color: var(--muted);
    }
    .auth-switch > summary::-webkit-details-marker { display: none; }
    .auth-switch > summary::after {
      content: ""; flex: none;
      width: .4rem; height: .4rem; margin-bottom: .15rem;
      border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
      transform: rotate(45deg);
    }
    .auth-switch[open] > summary::after { transform: rotate(-135deg); margin-top: .15rem; margin-bottom: 0; }
    .auth-switch .auth-form { margin: 0 0 .35rem; }
    .auth-switch .auth-hint { margin: .35rem 0 0; font-size: .78rem; }
    .tray-actions { display: flex; align-items: center; gap: 0; flex-shrink: 0; }
    .tray-bookmark, .tray-attach, .tray-clear, .tray-close {
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: var(--faint); padding: 0;
      border: 0; background: transparent; cursor: pointer;
      min-width: var(--tap); min-height: var(--tap);
      border-radius: .45rem;
    }
    @media (hover: hover) and (pointer: fine) {
      .tray-bookmark:hover, .tray-attach:hover, .tray-clear:hover, .tray-close:hover { color: var(--ink); background: var(--fill); }
    }
    .tray-bookmark:focus-visible, .tray-attach:focus-visible, .tray-clear:focus-visible, .tray-close:focus-visible {
      color: var(--ink); background: var(--fill);
    }
    .tray-bookmark.is-on { color: var(--ink); }
    .tray-bookmark svg, .tray-attach svg, .tray-clear svg, .tray-close svg {
      display: block; width: 1.05rem; height: 1.05rem;
    }
    .tray-attach.is-ok { color: var(--ink); }
    .att-board {
      list-style: none; margin: .15rem 0 0; padding: 0;
      display: flex; flex-wrap: wrap; gap: .3rem;
      align-items: center;
    }
    .att-board[hidden] { display: none !important; }
    .att-item {
      position: relative;
      display: inline-flex; align-items: center; gap: 0; max-width: 100%;
    }
    .att-chip {
      display: inline-flex; align-items: center; min-width: 0; max-width: 16rem;
      padding: .1rem .45rem;
      border: 1px solid var(--line); border-radius: 999px;
      background: var(--paper-raised); color: var(--ink-soft);
      text-decoration: none; font-size: .7rem; font-weight: 500;
      line-height: 1.25;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .att-chip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--ink) 28%, transparent); }
    .att-chip.is-fresh {
      color: var(--ink); border-color: var(--ink);
      animation: att-fresh .9s ease;
    }
    @keyframes att-fresh {
      0% { transform: scale(.92); background: color-mix(in srgb, var(--ink) 12%, var(--paper-raised)); }
      100% { transform: scale(1); background: var(--paper-raised); }
    }
    @media (prefers-reduced-motion: reduce) { .att-chip.is-fresh { animation: none; } }
    .att-remove {
      position: absolute; right: .18rem; top: 50%; z-index: 1;
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.15rem; height: 1.15rem; min-width: 1.15rem; min-height: 1.15rem; padding: 0;
      transform: translateY(-50%);
      border: 0; border-radius: 999px;
      /* Opaque chip fill masks the xref digits under the overlay. */
      background: var(--paper-raised);
      color: var(--faint); cursor: pointer;
      visibility: hidden; opacity: 0;
      transition: opacity .12s ease, color .12s ease, background .12s ease;
    }
    @media (hover: hover) and (pointer: fine) {
      .att-item:hover .att-remove,
      .att-item:focus-within .att-remove,
      .att-remove:focus-visible { visibility: visible; opacity: 1; }
      .att-remove:hover { color: var(--ink); background: var(--paper-raised); }
    }
    @media (hover: none), (pointer: coarse) {
      /* Touch still gets a tap target, but it stays quiet inside the pill. */
      .att-remove { visibility: visible; opacity: .72; }
      .verse-group .att-chip {
        max-width: none;
        font-size: .84rem;
      }
    }
    .att-remove:focus-visible { visibility: visible; opacity: 1; color: var(--ink); background: var(--paper-raised); }
    .att-remove svg { display: block; width: .7rem; height: .7rem; }
    /* Star and remove share the trailing edge of one quiet pill. */
    .verse-group .att-item {
      gap: 0;
      padding: .06rem .1rem .06rem .08rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--paper-raised);
    }
    .verse-group .att-item:hover { border-color: color-mix(in srgb, var(--ink) 28%, transparent); }
    .verse-group .att-chip {
      border: 0;
      background: transparent;
      /* Even side padding while the star and remove mark are collapsed. */
      padding: .1rem .42rem .1rem .38rem;
      font-size: .78rem;
      font-weight: 600;
    }
    .verse-group .att-chip:hover { border-color: transparent; background: transparent; }
    .verse-group .verse-star,
    .verse-group .att-remove {
      position: static;
      transform: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* Collapsed until a star is on, or the chip is hovered. Empty icon slots stay out of the pill. */
      width: 0;
      min-width: 0;
      height: 1.35rem;
      min-height: 1.35rem;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--faint);
      overflow: hidden;
      visibility: hidden;
      opacity: 0;
      cursor: pointer;
      /* Width snaps to the reserved size. Only the icon fades, so the row does not ease-shove. */
      transition: opacity .12s ease, color .12s ease;
    }
    @media (hover: hover) and (pointer: fine) {
      .verse-group .att-item:has(.verse-star[aria-pressed="true"]) .att-chip,
      .verse-group .att-item:hover .att-chip,
      .verse-group .att-item:focus-within .att-chip {
        padding-right: .12rem;
      }
      .verse-group .verse-star[aria-pressed="true"] {
        width: 1.35rem;
        min-width: 1.35rem;
        overflow: visible;
        visibility: visible;
        opacity: 1;
      }
      .verse-group .att-item:hover .verse-star,
      .verse-group .att-item:hover .att-remove,
      .verse-group .att-item:focus-within .verse-star,
      .verse-group .att-item:focus-within .att-remove,
      .verse-group .verse-star:focus-visible,
      .verse-group .att-remove:focus-visible {
        width: 1.35rem;
        min-width: 1.35rem;
        overflow: visible;
        visibility: visible;
        opacity: 1;
      }
      /* A remove or star reflow slides siblings under a still pointer. That borrowed
         hover must not open them. A real pointer move clears is-member-quiet. */
      .verse-group.is-member-quiet .att-item:hover:not(:focus-within):not(:has(.verse-star[aria-pressed="true"])) .att-chip {
        padding-right: .42rem;
      }
      .verse-group.is-member-quiet .att-item:hover:not(:focus-within) .verse-star:not([aria-pressed="true"]),
      .verse-group.is-member-quiet .att-item:hover:not(:focus-within) .att-remove {
        width: 0;
        min-width: 0;
        overflow: hidden;
        visibility: hidden;
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .verse-group .verse-star,
      .verse-group .att-remove { transition: none; }
    }
    .verse-group .verse-star svg,
    .verse-group .att-remove svg { display: block; width: .72rem; height: .72rem; }
    .verse-group .verse-star[aria-pressed="true"] { color: #b0893e; }
    .verse-group .verse-star:hover,
    .verse-group .att-remove:hover,
    .verse-group .verse-star:focus-visible,
    .verse-group .att-remove:focus-visible { color: var(--ink); background: transparent; }
    .verse-group .verse-star[aria-pressed="true"]:hover,
    .verse-group .verse-star[aria-pressed="true"]:focus-visible { color: #b0893e; }
    @media (hover: none), (pointer: coarse) {
      .verse-group .att-chip { font-size: .84rem; }
      .verse-group .verse-star,
      .verse-group .att-remove {
        visibility: visible;
        opacity: 1;
        width: var(--tap);
        height: var(--tap);
        min-width: var(--tap);
        min-height: var(--tap);
      }
      .verse-group .verse-star svg,
      .verse-group .att-remove svg { width: .85rem; height: .85rem; }
    }
    /* Phone topics keep a short wrapping chip row. Desktop already does. */
    @media (max-width: 767px) {
      .verse-group-verses,
      .verse-group-members,
      .verse-group-verses .att-board {
        margin-left: 0;
        padding-left: 0;
      }
      .verse-group-verses {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: .28rem;
      }
      .verse-group-members {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        width: 100%;
        gap: .28rem;
      }
      .verse-group .att-item {
        width: auto;
        max-width: 100%;
        box-sizing: border-box;
        justify-content: flex-start;
        align-items: center;
        min-height: 0;
        margin-left: 0;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--paper-raised);
        padding: 0 .08rem 0 0;
      }
      .verse-group .att-chip {
        flex: 0 1 auto;
        width: auto;
        max-width: 9.2rem;
        border: 0;
        border-radius: 0;
        background: transparent;
        padding: .16rem .12rem .16rem 0;
        font-size: .74rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
      }
      .verse-group .verse-star,
      .verse-group .att-remove {
        visibility: visible;
        opacity: 1;
        width: 1.35rem;
        min-width: 1.35rem;
        height: 1.35rem;
        min-height: 1.35rem;
        overflow: visible;
      }
      .verse-group .verse-star svg,
      .verse-group .att-remove svg { width: .68rem; height: .68rem; }
    }
    /* Desktop topics stay a compact list. Phone card padding stays under 767. */
    @media (min-width: 768px) {
      #verse-groups-view .note-list { display: block; }
      #verse-groups-view .verse-group {
        border: 0;
        border-radius: 0;
        background: transparent;
        overflow: visible;
      }
      #verse-groups-view .verse-group > summary.verse-group-row {
        min-height: 0;
        padding: .2rem .5rem .2rem var(--topic-inset);
        border-radius: .3rem;
      }
      #verse-groups-view .verse-count-pill {
        min-width: 1.2rem;
        height: 1.1rem;
        padding: 0 .32rem;
        font-size: .66rem;
      }
      #verse-groups-view .verse-group[open] > summary .verse-group-title-edit,
      #verse-groups-view .verse-group[open] > summary .tray-attach {
        width: 1.4rem;
        height: 1.4rem;
        min-width: 1.4rem;
        min-height: 1.4rem;
      }
      #verse-groups-view .verse-group[open] > summary .verse-group-title-edit svg,
      #verse-groups-view .verse-group[open] > summary .tray-attach svg {
        width: .8rem;
        height: .8rem;
      }
      #verse-groups-view .verse-group-form {
        gap: .12rem;
        padding: .15rem .4rem .1rem var(--topic-inset);
      }
      #verse-groups-view .verse-group-fields {
        margin: 0;
        padding: 0;
        border-left: 0;
      }
      #verse-groups-view .verse-group-form textarea.verse-group-description {
        height: 1.45rem;
        min-height: 0;
        max-height: 1.45rem;
        padding: .08rem .35rem .08rem 0;
        resize: none;
        overflow: hidden;
        font-size: .78rem;
        line-height: 1.25;
      }
      #verse-groups-view .verse-group-verses,
      #verse-groups-view .verse-group-members,
      #verse-groups-view .verse-group-verses .att-board {
        margin-left: 0;
        padding-left: 0;
      }
      #verse-groups-view .verse-group-verses {
        gap: .1rem .2rem;
      }
      #verse-groups-view .verse-group-members {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: .1rem .2rem;
      }
      #verse-groups-view .verse-group .att-item {
        width: auto;
        max-width: 100%;
        min-height: 0;
        margin-left: 0;
        padding: 0 .04rem 0 0;
      }
      #verse-groups-view .verse-group .att-chip {
        max-width: 11rem;
        padding: .02rem .22rem .02rem 0;
        font-size: .7rem;
        line-height: 1.2;
      }
    }
    @media (min-width: 768px) {
      .verse-group .verse-star,
      .verse-group .att-remove {
        width: 0;
        min-width: 0;
        height: 1.15rem;
        min-height: 0;
        visibility: hidden;
        opacity: 0;
      }
    }
    a.wiki {
      color: var(--ink-soft); text-decoration: underline;
      text-decoration-thickness: 1px; text-underline-offset: .15em;
      text-decoration-color: color-mix(in srgb, var(--ink) 28%, transparent);
    }
    a.wiki:hover { color: var(--ink); }
    .att-drop {
      width: min(36rem, calc(100vw - 1.5rem));
      max-width: 100%; padding: 0; border: 0; background: transparent;
    }
    .att-drop::backdrop { background: color-mix(in srgb, var(--ink) 42%, transparent); }
    .att-drop-sheet {
      position: relative; margin: 0; background: var(--paper);
      border: 1px dashed color-mix(in srgb, var(--ink) 22%, transparent);
      border-radius: 1rem; overflow: visible;
    }
    .att-drop-sheet:has(.att-drop-zone.is-over),
    .att-drop-sheet:has(.att-drop-zone.is-ok) {
      border-color: var(--ink);
      background-color: color-mix(in srgb, var(--ink) 5%, var(--paper));
    }
    .att-drop-sheet:has(.att-drop-zone.is-ok) { border-style: solid; }
    .att-drop-sheet:has(.att-drop-zone.is-bad) {
      border-color: color-mix(in srgb, var(--ink) 40%, transparent);
    }
    .att-drop-close {
      position: absolute; top: .35rem; right: .35rem; z-index: 3;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--tap); height: var(--tap); min-width: var(--tap); min-height: var(--tap); padding: 0;
      border: 0; border-radius: 999px; background: transparent;
      color: var(--muted); cursor: pointer;
    }
    .att-drop-close:hover { color: var(--ink); background: var(--fill); }
    .att-drop-zone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: .65rem; min-height: 14rem; margin: 0; padding: 2.4rem 1.4rem 1.6rem;
      border: 0; border-radius: 0; text-align: center;
    }
    .att-drop-check { margin: 0; color: var(--ink); line-height: 0; font-size: 1.5rem; }
    .att-drop-title {
      margin: 0; font-size: 1.25rem; font-weight: 600; letter-spacing: -.02em; color: var(--ink);
    }
    .att-drop-sub {
      margin: 0; max-width: 22rem; font-size: .85rem; line-height: 1.45; color: var(--muted);
    }
    .att-drop-field {
      position: relative; width: min(22rem, 100%); margin-top: .35rem; z-index: 2; text-align: left;
      display: flex; flex-direction: column;
      border: 1px solid transparent; border-radius: .75rem;
      background: transparent;
    }
    .att-drop-input {
      width: 100%; margin-top: 0; padding: .7rem .9rem;
      border: 1px solid var(--line); border-radius: 999px;
      background: var(--paper-raised); color: var(--ink); font-size: 1rem;
    }
    .att-drop-input:focus, .att-drop-input:focus-visible {
      outline: none; border-color: color-mix(in srgb, var(--ink) 35%, transparent);
    }
    /* Suggest flows attached under the input (jump-field parity) — not absolute/clipped by dialog. */
    .att-drop-field .suggest {
      position: relative; left: auto; right: auto; top: auto;
      border: 1px solid var(--line); border-top: 0;
      border-radius: 0 0 .75rem .75rem;
      background: var(--paper-raised);
      z-index: 8;
    }
    .att-drop-field.is-open,
    .att-drop-field:has(.suggest:not([hidden])) {
      border-color: color-mix(in srgb, var(--ink) 35%, transparent);
      background: var(--paper-raised);
    }
    .att-drop-field.is-open .att-drop-input,
    .att-drop-field:has(.suggest:not([hidden])) .att-drop-input {
      border-radius: .75rem .75rem 0 0;
      border-color: transparent;
      border-bottom: 1px solid var(--line);
      background: transparent;
    }
    .att-drop-field.is-open .suggest,
    .att-drop-field:has(.suggest:not([hidden])) .suggest {
      border-color: transparent;
      border-top: 1px solid var(--line);
      background: transparent;
    }
    .att-drop-add {
      appearance: none; border: 0; border-radius: 999px;
      padding: .55rem 1.1rem; background: var(--ink); color: var(--paper);
      font-size: .85rem; font-weight: 600; cursor: pointer;
    }
    .att-drop-status {
      min-height: 1.2em; margin: 0; padding: .15rem 1.2rem 1rem;
      font-size: .8rem; color: var(--ink-soft); text-align: center;
    }
    .att-drop-status.is-error { color: #9f1239; }
    html[data-theme="dark"] .att-drop-status.is-error { color: #fecdd3; }

    .chapter-grid {
      position: fixed; inset: 0; z-index: 40;
      display: flex; align-items: flex-start; justify-content: center;
      padding: calc(var(--tap) + var(--safe-top) + .7rem) 1rem 2rem;
      background: color-mix(in srgb, var(--ink) 28%, transparent);
    }
    .chapter-grid[hidden] { display: none; }
    .chapter-grid-handle { display: none; }
    .chapter-grid-sheet {
      width: min(28rem, 100%);
      max-height: min(36rem, calc(100dvh - 6rem));
      overflow: auto;
      padding: 1rem 1rem 1.15rem;
      background: var(--paper-raised);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 12px 40px color-mix(in srgb, var(--ink) 12%, transparent);
    }
    .chapter-grid-book {
      appearance: none; -webkit-appearance: none;
      display: inline-flex; align-items: center; gap: .35rem;
      width: auto; max-width: 100%; margin: 0 0 .75rem; padding: 0;
      border: 0; background: transparent; cursor: pointer;
      font: inherit; text-align: left;
      font-family: var(--head);
      font-size: .82rem; font-weight: 600;
      letter-spacing: .06em; text-transform: uppercase;
      color: var(--muted);
    }
    .chapter-grid-book::after {
      content: "";
      width: .38rem; height: .38rem;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: rotate(-45deg);
      opacity: .7;
    }
    .chapter-grid-book[aria-expanded="true"]::after {
      transform: rotate(45deg);
      margin-bottom: .15rem;
    }
    .chapter-grid-book:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--ink) 28%, transparent);
      outline-offset: 2px;
    }
    .chapter-grid-books[hidden],
    .chapter-grid-cells[hidden] { display: none; }
    .chapter-grid-group {
      margin: .85rem 0 .4rem;
      font-size: .72rem; font-weight: 600;
      letter-spacing: .06em; text-transform: uppercase;
      color: var(--faint);
    }
    .chapter-grid-group:first-child { margin-top: 0; }
    .chapter-grid-cells {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--tap), 1fr));
      gap: .4rem;
    }
    .chapter-grid-cell {
      display: flex; align-items: center; justify-content: center;
      min-height: var(--tap); min-width: var(--tap);
      border: 1px solid var(--line); border-radius: 8px;
      text-decoration: none; color: var(--ink);
      font-variant-numeric: lining-nums;
      background: transparent; cursor: pointer; font: inherit;
    }
    .chapter-grid-cell.is-current {
      background: var(--ink); color: var(--paper); border-color: var(--ink);
    }

    .auth-chip {
      min-height: var(--tap);
      box-sizing: border-box;
    }
    .suggest button { min-height: var(--tap); }
    .note-list .note-row { min-height: var(--tap); }
    @media (max-width: 640px) {
      .topbar {
        grid-template-columns: auto minmax(min-content, 1fr) auto;
        gap: .25rem;
        padding-left: calc(.5rem + env(safe-area-inset-left, 0px));
        padding-right: calc(.5rem + env(safe-area-inset-right, 0px));
      }
      .topbar-title { font-size: .95rem; overflow: visible; }
      .topbar:not(.topbar-notes) .topbar-title-btn {
        flex: 0 0 auto;
        min-width: min-content;
        overflow: visible;
        text-overflow: clip;
      }
      /* A long chapter name fills the middle track. Keep the bookmark on the title's left,
         with a gap before the Notes icon. The title itself does not ellipsize. */
      .topbar-chapter-mark { margin-inline-start: .75rem; }
      .expand-btn { width: var(--tap); padding: 0; justify-content: center; }
      .reader, .verse, .chapter {
        --verse-gutter: 1.2rem;
        --verse-gutter-gap: .45rem;
        --verse-inset: .65rem;
      }
      #reader:has(.reader-verse-rail) .chapter,
      #reader:has(.reader-verse-rail) .pager { padding-right: .85rem; }
      .note-tray, .chapter-tray {
        margin-left: calc(var(--verse-gutter) + var(--verse-gutter-gap));
        padding-right: 0;
      }
      .chapter-tray {
        margin-left: 0;
        padding: .24rem 0 .36rem;
      }
      .chapter-note-peek { min-height: 1rem; padding: .3rem 0; }
      .outliner { padding: .15rem 0; min-height: 0; }
      .chapter-tray .outliner { padding: .32rem 0; }
      .oblock {
        padding-left: calc(.35rem + (var(--depth, 0) * .95rem));
        padding-right: .45rem;
      }
      .hint { font-size: .78rem; }
      .pager { margin-bottom: calc(3.4rem + 14px + 1rem + var(--safe-bottom)); }
      main.reader, .notes-main, footer.site {
        width: min(var(--page-max), calc(100% - 1.1rem));
      }
    }
    @media (max-width: 390px) {
      .reader, .verse, .chapter {
        --verse-gutter: 1.05rem;
        --verse-gutter-gap: .35rem;
        --verse-inset: .5rem;
      }
      .oblock { padding-left: calc(.25rem + (var(--depth, 0) * .85rem)); }
      .tray-label { font-size: .72rem; }
    }
    @media (max-width: 767px) {
      .pager {
        margin-bottom: calc(3.4rem + 14px + 1rem + var(--phone-tab-h, var(--safe-bottom)));
      }
      .pager a, .pager span {
        display: inline-flex; align-items: center;
        min-height: var(--tap); padding: .2rem 0;
      }
      main.notes-main {
        width: 100%;
        max-width: none;
        padding-bottom: calc(3.4rem + 14px + 1.25rem + var(--phone-tab-h, var(--safe-bottom)));
      }
      .notes-main > .jump,
      .notes-main > .starter-chips,
      .notes-main > #notes-mount > .empty {
        margin-left: max(.7rem, env(safe-area-inset-left, 0px));
        margin-right: max(.7rem, env(safe-area-inset-right, 0px));
      }
      /* Phone notes feed is a full-bleed list. Desktop keeps the week frame. */
      .notes-main > #notes-mount .note-week {
        border: 0;
        margin-bottom: 0;
      }
      .notes-main > #notes-mount .note-week-label {
        padding-left: calc(1rem + env(safe-area-inset-left, 0px));
        padding-right: calc(1rem + env(safe-area-inset-right, 0px));
      }
      .notes-main > #notes-mount .note-list > li {
        border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
      }
      .notes-main > #notes-mount .note-week .note-row,
      .notes-main > #notes-mount .note-week .note-bundle {
        width: 100%;
        border-radius: 0;
        padding-left: calc(1rem + env(safe-area-inset-left, 0px));
        padding-right: calc(1rem + env(safe-area-inset-right, 0px));
        box-sizing: border-box;
      }
      .chapter-grid {
        align-items: flex-end;
        justify-content: stretch;
        padding: 0;
      }
      .chapter-grid-sheet {
        width: 100%;
        max-width: none;
        max-height: min(82dvh, calc(100dvh - var(--safe-top) - .5rem));
        margin: 0;
        padding: 0 1rem calc(1.1rem + var(--safe-bottom));
        border: 0;
        border-radius: 0;
        box-shadow: none;
        background: var(--paper-raised);
        overflow: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      .chapter-grid-handle {
        display: flex; align-items: center; justify-content: center;
        position: sticky; top: 0; z-index: 2;
        min-height: var(--tap);
        margin: 0 -1rem;
        background: var(--paper-raised);
        touch-action: none;
        cursor: grab;
      }
      .chapter-grid-handle::before {
        content: "";
        width: 2.5rem; height: .28rem; border-radius: 999px;
        background: color-mix(in srgb, var(--ink) 28%, transparent);
      }
      .chapter-grid-book { min-height: var(--tap); padding: .2rem 0; }
      .chapter-grid-group {
        position: sticky;
        top: var(--tap);
        z-index: 1;
        margin: 0;
        padding: .55rem 0 .35rem;
        background: var(--paper-raised);
      }
      .chapter-grid-cell {
        min-height: 3.25rem;
        font-size: 1.05rem;
      }
      .note-tray .att-chip,
      .chapter-tray .att-chip {
        max-width: 100%;
        white-space: normal;
        line-height: 1.35;
        padding: .35rem .65rem;
      }
      .bookmarks-panel .note-list > li > a.note-row,
      .verse-group > summary.note-row {
        flex-wrap: wrap;
        align-items: center;
        row-gap: .12rem;
      }
      .bookmarks-panel .note-row-title,
      .verse-group > summary .note-row-title,
      .bookmarks-panel .note-row-excerpt,
      .verse-group > summary .note-row-excerpt {
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
      }
      .bookmarks-panel .note-row-excerpt,
      .verse-group > summary .note-row-excerpt {
        flex: 1 0 100%;
        order: 3;
        font-size: .84rem;
        color: var(--muted);
      }
      .verse-group-title-actions { order: 1; }
      #verse-groups-view .verse-group > summary .note-row-title {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .verse-group[open] > summary .note-row-excerpt {
        color: color-mix(in srgb, var(--paper) 86%, transparent);
      }
      .att-drop-sheet { padding-bottom: var(--safe-bottom); }
    }
  </style>
</head>
<body data-margin-build="20260930-tray-compact-v23">
  ${body}
</body>
</html>`;
}
