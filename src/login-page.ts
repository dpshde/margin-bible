import { escapeHtml, page, themeToggleHtml } from "./html";

export function renderLoginPage(input: {
  error?: string;
  notice?: string;
  next?: string;
  signedIn?: boolean;
}): string {
  const next = safeNext(input.next);
  const error = input.error
    ? `<p class="auth-error" role="alert">${escapeHtml(input.error)}</p>`
    : "";
  const notice = input.notice
    ? `<p class="auth-notice">${escapeHtml(input.notice)}</p>`
    : "";

  const body = input.signedIn
    ? signedInBody({ next, error, notice })
    : signedOutBody({ next, error, notice });

  return page(
    input.signedIn ? "Profile · Margin" : "Sign in · Margin",
    `<header class="topbar">
  <div class="topbar-side"><a class="icon-btn" href="${escapeHtml(next)}" aria-label="Back" title="Back">←</a></div>
  <h1 class="topbar-title">${input.signedIn ? "Profile" : "Sign in"}</h1>
  <div class="topbar-actions">${themeToggleHtml()}</div>
</header>
<main class="auth-main">
  ${body}
</main>`,
  );
}

function signedInBody(input: { next: string; error: string; notice: string }): string {
  return `<div class="auth-signed">
  ${input.notice}
  <div class="auth-status-card">
    <p class="auth-status">You are signed in. Notes in this browser follow your passphrase library.</p>
    <a class="menu-item export-link auth-export" href="/export">${iconDownload()} <span>Download notes</span></a>
    <form class="auth-form" method="post" action="/logout">
      <input type="hidden" name="next" value="${escapeHtml(input.next)}">
      <button type="submit">Sign out</button>
    </form>
  </div>
  ${input.error}
  <details class="auth-switch">
    <summary>Switch library</summary>
    <form class="auth-form" method="post" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(input.next)}">
      <label for="passphrase">Passphrase</label>
      <input id="passphrase" name="passphrase" type="password" autocomplete="current-password" minlength="4" maxlength="200" required placeholder="at least 4 characters">
      <label for="label">Label <span class="optional">(optional)</span></label>
      <input id="label" name="label" type="text" maxlength="80" placeholder="Dylan’s demo">
      <button type="submit" class="auth-secondary">Open library</button>
    </form>
    <p class="auth-hint">Same passphrase reopens the same notes in another browser. There is no reset.</p>
  </details>
</div>`;
}

function signedOutBody(input: { next: string; error: string; notice: string }): string {
  return `<p class="auth-lead">Enter a passphrase to bind notes to a stable library. The same passphrase opens the same notes in any browser. Guest mode (no sign-in) keeps notes only in that browser’s cookie.</p>
  ${input.notice}
  ${input.error}
  <form class="auth-form" method="post" action="/login">
    <input type="hidden" name="next" value="${escapeHtml(input.next)}">
    <label for="passphrase">Passphrase</label>
    <input id="passphrase" name="passphrase" type="password" autocomplete="current-password" minlength="4" maxlength="200" required placeholder="at least 4 characters" autofocus>
    <label for="label">Label <span class="optional">(optional)</span></label>
    <input id="label" name="label" type="text" maxlength="80" placeholder="Dylan’s demo">
    <button type="submit">Open library</button>
  </form>
  <p class="auth-hint">Passphrase auth — not OAuth, not magic email. Pick a phrase you will remember; there is no reset.</p>`;
}

function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login") || raw.startsWith("/logout")) return "/";
  return raw;
}

function iconDownload(): string {
  // Phosphor download, regular weight (Rails ph_icon("download") parity).
  const d =
    "M224 152v56a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16v-56a8 8 0 0 1 16 0v56h160v-56a8 8 0 0 1 16 0m-101.66 5.66a8 8 0 0 0 11.32 0l40-40a8 8 0 0 0-11.32-11.32L136 132.69V40a8 8 0 0 0-16 0v92.69L93.66 106.34a8 8 0 0 0-11.32 11.32Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}
