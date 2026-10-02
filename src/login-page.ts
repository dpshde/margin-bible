import { escapeHtml, page, themeToggleHtml } from "./html";

export function renderLoginPage(input: {
  error?: string;
  notice?: string;
  next?: string;
  signedIn?: boolean;
  passkeys?: boolean;
  savedPasskeys?: SavedPasskey[];
  confirmCreate?: boolean;
  openPassphrase?: boolean;
}): string {
  const next = safeNext(input.next);
  const error = input.error
    ? `<p class="auth-error" role="alert">${escapeHtml(input.error)}</p>`
    : "";
  const notice = input.notice
    ? `<p class="auth-notice">${escapeHtml(input.notice)}</p>`
    : "";
  const passkeys = Boolean(input.passkeys);
  const savedPasskeys = input.savedPasskeys ?? [];
  const confirmCreate = Boolean(input.confirmCreate);
  const openPassphrase = Boolean(input.openPassphrase);

  const body = input.signedIn
    ? signedInBody({ next, error, notice, passkeys, savedPasskeys, confirmCreate, openPassphrase })
    : signedOutBody({ next, error, notice, passkeys, confirmCreate });

  return page(
    input.signedIn ? "Profile · Margin" : "Sign in · Margin",
    `<header class="topbar">
  <div class="topbar-side"><a class="icon-btn" href="${escapeHtml(next)}" aria-label="Back" title="Back">←</a></div>
  <h1 class="topbar-title">${input.signedIn ? "Profile" : "Sign in"}</h1>
  <div class="topbar-actions">${themeToggleHtml()}</div>
</header>
<main class="auth-main">
  ${body}
</main>
${passkeys ? passkeyScript() : ""}`,
  );
}

function signedInBody(input: {
  next: string;
  error: string;
  notice: string;
  passkeys: boolean;
  savedPasskeys: SavedPasskey[];
  confirmCreate: boolean;
  openPassphrase: boolean;
}): string {
  return `<div class="auth-signed">
  ${input.notice}
  <div class="auth-status-card">
    <a class="menu-item export-link auth-export" href="/export">${iconDownload()} <span>Download notes</span></a>
    ${input.passkeys ? passkeyAccountHtml(input.savedPasskeys) : ""}
    <form class="auth-form" method="post" action="/logout">
      <input type="hidden" name="next" value="${escapeHtml(input.next)}">
      <button type="submit">Sign out</button>
    </form>
  </div>
  ${input.error}
  <details class="auth-switch"${input.openPassphrase ? " open" : ""}>
    <summary>Change passphrase</summary>
    <form class="auth-form" method="post" action="/login/passphrase">
      <input type="hidden" name="next" value="${escapeHtml(input.next)}">
      <label for="current-passphrase">Current passphrase</label>
      <input id="current-passphrase" name="current_passphrase" type="password" autocomplete="current-password" minlength="12" maxlength="200" required placeholder="at least 12 characters">
      <label for="new-passphrase">New passphrase</label>
      <input id="new-passphrase" name="passphrase" type="password" autocomplete="new-password" minlength="12" maxlength="200" required placeholder="at least 12 characters">
      <label for="confirm-passphrase">New passphrase again</label>
      <input id="confirm-passphrase" name="confirm_passphrase" type="password" autocomplete="new-password" minlength="12" maxlength="200" required placeholder="at least 12 characters">
      <button type="submit" class="auth-secondary">Save passphrase</button>
    </form>
    <p class="auth-hint">Other browsers are signed out.</p>
  </details>
  <details class="auth-switch"${input.confirmCreate ? " open" : ""}>
    <summary>Switch library</summary>
    <form class="auth-form" method="post" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(input.next)}">
      ${input.confirmCreate ? `<input type="hidden" name="confirm_create" value="1">` : ""}
      <label for="passphrase">Passphrase</label>
      <input id="passphrase" name="passphrase" type="password" autocomplete="current-password" minlength="12" maxlength="200" required placeholder="at least 12 characters">
      <label for="label">Label <span class="optional">(optional)</span></label>
      <input id="label" name="label" type="text" maxlength="80" placeholder="A name for this library">
      <button type="submit" class="auth-secondary">${input.confirmCreate ? "Create library" : "Open library"}</button>
    </form>
  </details>
</div>`;
}

function signedOutBody(input: {
  next: string;
  error: string;
  notice: string;
  passkeys: boolean;
  confirmCreate: boolean;
}): string {
  return `<p class="auth-lead">Enter a passphrase to keep these notes. The same passphrase opens them in any browser. Until you sign in, notes stay in this browser’s session.</p>
  ${input.notice}
  ${input.error}
  ${input.passkeys ? `<button type="button" class="auth-secondary passkey-btn" id="passkey-login">Sign in with a passkey</button><p class="auth-hint">A passkey works on this website address.</p><p id="passkey-error" class="auth-error" hidden></p>` : ""}
  <form class="auth-form" method="post" action="/login">
    <input type="hidden" name="next" value="${escapeHtml(input.next)}">
    ${input.confirmCreate ? `<input type="hidden" name="confirm_create" value="1">` : ""}
    <label for="passphrase">Passphrase</label>
    <input id="passphrase" name="passphrase" type="password" autocomplete="current-password" minlength="12" maxlength="200" required placeholder="at least 12 characters" autofocus>
    <label for="label">Label <span class="optional">(optional)</span></label>
    <input id="label" name="label" type="text" maxlength="80" placeholder="A name for this library">
    <details class="auth-switch">
      <summary>Recovery code</summary>
      <label for="claim">Code</label>
      <input id="claim" name="claim" type="text" autocomplete="one-time-code" maxlength="200" placeholder="Only if you were given one">
    </details>
    <button type="submit">${input.confirmCreate ? "Create library" : "Open library"}</button>
  </form>
  <p class="auth-hint">Pick a phrase you will remember. There is no email reset.</p>`;
}

function passkeyScript(): string {
  return `<script>
(function () {
  var add = document.getElementById("passkey-add");
  var login = document.getElementById("passkey-login");
  var err = document.getElementById("passkey-error");
  function show(message) {
    if (!err) return;
    err.hidden = false;
    err.textContent = message;
  }
  function supported() {
    return window.PublicKeyCredential && PublicKeyCredential.parseCreationOptionsFromJSON && PublicKeyCredential.parseRequestOptionsFromJSON;
  }
  async function post(url, body) {
    var response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body ? JSON.stringify(body) : "{}"
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || "Passkey request failed");
    return data;
  }
  if (add) add.addEventListener("click", function () {
    if (!supported()) { show("This browser cannot create a passkey."); return; }
    post("/api/passkey/register/options").then(function (data) {
      return navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(data.options) });
    }).then(function (cred) {
      if (!cred || !cred.toJSON) throw new Error("No passkey was created");
      return post("/api/passkey/register/verify", cred.toJSON());
    }).then(function () {
      location.assign("/login?passkey=1");
    }).catch(function (error) {
      show(passkeyMessage(error, "Could not add a passkey"));
    });
  });
  if (login) login.addEventListener("click", function () {
    if (!supported()) { show("This browser cannot use a passkey."); return; }
    post("/api/passkey/login/options").then(function (data) {
      return navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(data.options) });
    }).then(function (cred) {
      if (!cred || !cred.toJSON) throw new Error("No passkey was selected");
      return post("/api/passkey/login/verify", cred.toJSON());
    }).then(function (data) {
      location.assign(data.next || "/");
    }).catch(function (error) {
      show(passkeyMessage(error, "Could not sign in with a passkey"));
    });
  });
  function passkeyMessage(error, fallback) {
    var name = error && error.name;
    if (name === "NotAllowedError" || name === "AbortError") return "Passkey was cancelled.";
    return error && error.message ? error.message : fallback;
  }
})();
</script>`;
}

export type SavedPasskey = { id: string; createdAt: string };

function passkeyAccountHtml(saved: SavedPasskey[]): string {
  const count = saved.length;
  const heading =
    count === 0
      ? `<p class="passkey-kicker" id="passkey-count">No passkey yet.</p>`
      : `<ul class="passkey-list" id="passkey-count">${saved.map((row, index) => passkeyRowHtml(row, index, count)).join("")}</ul>`;
  const button = count === 0 ? "Add a passkey" : "Add another passkey";
  return `<div class="passkey-account">
${heading}
<button type="button" class="auth-secondary passkey-btn" id="passkey-add" title="Only works on this website address.">${button}</button>
<p id="passkey-error" class="auth-error" hidden></p>
</div>`;
}

function passkeyRowHtml(row: SavedPasskey, index: number, total: number): string {
  const line = passkeyLine(row.createdAt, index, total);
  const when = formatPasskeyDate(row.createdAt);
  const name = total === 1 ? "Passkey" : `Passkey ${index + 1}`;
  return `<li>
  <span class="passkey-name">${escapeHtml(name)}</span>
  ${when ? `<span class="passkey-when">${escapeHtml(when)}</span>` : ""}
  <form method="post" action="/login/passkey/delete" onsubmit="return confirm('Remove this passkey?')">
    <input type="hidden" name="credential_id" value="${escapeHtml(row.id)}">
    <button type="submit" class="passkey-remove" aria-label="${escapeHtml(`Remove ${line}`)}" title="Remove">${iconTrash()}</button>
  </form>
</li>`;
}

function passkeyLine(iso: string, index: number, total: number): string {
  const when = formatPasskeyDate(iso);
  const name = total === 1 ? "Passkey" : `Passkey ${index + 1}`;
  return when ? `${name} · added ${when}` : name;
}

function formatPasskeyDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login") || raw.startsWith("/logout")) return "/";
  return raw;
}

function iconTrash(): string {
  // Phosphor trash, regular. Same glyph as the note tray clear button.
  const d =
    "M216 48H176V40a24 24 0 0 0-24-24H104A24 24 0 0 0 80 40v8H40a8 8 0 0 0 0 16h8V208a16 16 0 0 0 16 16H192a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16ZM96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64H192ZM112 104v64a8 8 0 0 1-16 0V104a8 8 0 0 1 16 0Zm48 0v64a8 8 0 0 1-16 0V104a8 8 0 0 1 16 0Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}

function iconDownload(): string {
  // Phosphor download, regular weight (Rails ph_icon("download") parity).
  const d =
    "M224 152v56a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16v-56a8 8 0 0 1 16 0v56h160v-56a8 8 0 0 1 16 0m-101.66 5.66a8 8 0 0 0 11.32 0l40-40a8 8 0 0 0-11.32-11.32L136 132.69V40a8 8 0 0 0-16 0v92.69L93.66 106.34a8 8 0 0 0-11.32 11.32Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}
