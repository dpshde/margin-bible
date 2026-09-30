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
    expect(html).toContain("You are signed in");
    expect(html).toContain('href="/export"');
    expect(html).toContain("Download notes");
    expect(html).toContain(">Sign out</button>");
    expect(html).toContain('<details class="auth-switch">');
    expect(html).toContain("Switch library");
    expect(html).toContain('class="auth-secondary">Open library</button>');
    expect(html).not.toContain("autofocus");
    // Sign out appears before Switch library disclosure
    expect(html.indexOf("Sign out")).toBeLessThan(html.indexOf("Switch library"));
    expect(html.indexOf("Download notes")).toBeLessThan(html.indexOf("Sign out"));
  });
});
