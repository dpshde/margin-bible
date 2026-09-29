export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='2' fill='%232c241c'/%3E%3Cpath d='M4 4.5h8M4 8h8M4 11.5h5' stroke='%23f6f1e8' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink: #1c1915; --muted: #6b645c; --line: #e4ddd4; --paper: #faf7f2; --tray: #fff; --focus: #f3e6c8; --accent: #8a4b08; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font: 18px/1.55 "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif; }
    a { color: var(--accent); }
    header, main, footer { width: min(42rem, calc(100% - 2rem)); margin: 0 auto; }
    .banner { background: #2c241c; color: #f6f1e8; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.01em; }
    .banner p { width: min(42rem, calc(100% - 2rem)); margin: 0 auto; padding: 0.45rem 0; }
    .top { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 1.25rem 0 0.25rem; font-family: ui-sans-serif, system-ui, sans-serif; }
    .top h1 { font: 600 1.15rem/1.3 ui-sans-serif, system-ui, sans-serif; margin: 0; }
    .top nav, .jump, .tray, .note-list, .pager { font-family: ui-sans-serif, system-ui, sans-serif; }
    .jump { display: flex; gap: 0.5rem; margin: 0.75rem 0 1rem; }
    .jump input { flex: 1; font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; background: var(--tray); }
    button, .jump button { font: inherit; background: #2c241c; color: #fff; border: 0; border-radius: 6px; padding: 0.45rem 0.75rem; }
    .tray { background: var(--tray); border: 1px solid var(--line); border-radius: 10px; padding: 0.8rem 0.9rem 0.9rem; margin-bottom: 1rem; }
    .tray-label { margin: 0 0 0.45rem; font-size: 0.85rem; color: var(--muted); }
    textarea { width: 100%; min-height: 6.5rem; font: 16px/1.45 ui-sans-serif, system-ui, sans-serif; border: 1px solid var(--line); border-radius: 6px; padding: 0.55rem 0.65rem; resize: vertical; }
    .tray-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-top: 0.5rem; }
    .status { margin: 0; color: var(--muted); font-size: 0.85rem; }
    h2 { font: 600 0.95rem/1.3 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.01em; margin: 1.4rem 0 0.35rem; }
    .verse { margin: 0.35rem 0; padding: 0.15rem 0.35rem; border-radius: 6px; }
    .verse.is-focus { background: var(--focus); }
    .vnum { font: 600 0.75rem/1 ui-sans-serif, system-ui, sans-serif; color: var(--muted); text-decoration: none; margin-right: 0.35rem; vertical-align: super; }
    .verse.is-focus .vnum, .has-note .vnum { color: var(--accent); }
    .note-list { list-style: none; padding: 0; margin: 0 0 1.25rem; }
    .note-list li { border-top: 1px solid var(--line); padding: 0.45rem 0; font-size: 0.92rem; }
    .note-list a { text-decoration: none; }
    .note-list p { margin: 0.15rem 0 0; color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.85rem; }
    .pager { display: flex; justify-content: space-between; gap: 1rem; margin: 1.5rem 0 2rem; font-size: 0.95rem; }
    .empty { color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.92rem; }
    footer { padding-bottom: 2rem; color: var(--muted); font: 0.8rem/1.4 ui-sans-serif, system-ui, sans-serif; }
  </style>
</head>
<body>
  <div class="banner"><p>Labs spike · Workers + D1 debug page · the client is SwiftUI, not this page</p></div>
  ${body}
</body>
</html>`;
}
