import { describe, expect, test } from "bun:test";
import { renderLoginPage } from "../src/login-page";

describe("login / profile page", () => {
  test("signed out leads with Open library form", () => {
    const html = renderLoginPage({ next: "/jhn.3" });
    expect(html).toContain("Sign in · Margin");
    expect(html).toContain(">Open library</button>");
    expect(html).toContain('autofocus');
    expect(html).not.toContain("Switch library");
    expect(html).not.toContain("You are signed in");
  });

  test("signed in leads with status + Sign out; Open library is collapsed", () => {
    const html = renderLoginPage({ signedIn: true, next: "/heb.12.1" });
    expect(html).toContain("Profile · Margin");
    expect(html).not.toContain("You are signed in");
    expect(html).toContain('href="/export"');
    expect(html).toContain("Download notes");
    expect(html).toContain(">Sign out</button>");
    expect(html).toContain('<details class="auth-switch">');
    expect(html).toContain("Switch library");
    expect(html).toContain("Change passphrase");
    expect(html).toContain('name="current_passphrase"');
    expect(html).toContain('name="confirm_passphrase"');
    expect(html).toContain('class="auth-secondary">Open library</button>');
    const changing = renderLoginPage({ signedIn: true, openPassphrase: true, error: "Current passphrase did not match." });
    expect(changing).toContain('<details class="auth-switch" open>');
    expect(changing).toContain("Current passphrase did not match.");
    expect(html).not.toContain("autofocus");
    // Sign out appears before Switch library disclosure
    expect(html.indexOf("Sign out")).toBeLessThan(html.indexOf("Switch library"));
    expect(html.indexOf("Download notes")).toBeLessThan(html.indexOf("Sign out"));
  });

  test("signed in lists saved passkeys and offers another", () => {
    const html = renderLoginPage({
      signedIn: true,
      passkeys: true,
      savedPasskeys: [
        { id: "cred-one", createdAt: "2026-10-02T15:04:00.000Z" },
        { id: `quote"amp&lt`, createdAt: "2026-10-03T15:04:00.000Z" },
      ],
    });
    expect(html).not.toContain("passkeys on this library");
    expect(html).not.toContain("Works only on this website address.");
    expect(html).toContain("Passkey 1");
    expect(html).toContain("Oct 2, 2026");
    expect(html).toContain("Passkey 2");
    expect(html).toContain("Oct 3, 2026");
    expect(html).not.toContain("Added Oct 2, 2026");
    expect(html).toContain('action="/login/passkey/delete"');
    expect(html).toContain("return confirm('Remove this passkey?')");
    expect(html).toContain('name="credential_id" value="cred-one"');
    expect(html).toContain('value="quote&quot;amp&amp;lt"');
    expect(html).toContain('aria-label="Remove Passkey 1 · added Oct 2, 2026"');
    expect(html).toContain('class="passkey-remove"');
    expect(html).toContain('title="Remove"');
    expect(html).toContain("M216 48H176V40a24 24 0 0 0-24-24H104");
    expect(html).not.toContain(">Remove</button>");
    expect(html).toContain(">Add another passkey</button>");
    expect(html).not.toContain("No passkey yet.");
    expect(html).not.toContain('quote"amp');
  });

  test("signed in with passkeys and none saved says so", () => {
    const html = renderLoginPage({ signedIn: true, passkeys: true, savedPasskeys: [] });
    expect(html).toContain("No passkey yet.");
    expect(html).toContain(">Add a passkey</button>");
    expect(html).not.toContain('<ul class="passkey-list">');
  });
});
