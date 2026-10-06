import { describe, expect, test } from "bun:test";
import { hostnameLabel, pageTitleFromHtml, publicHttpUrl, resolveLinkTitle } from "../src/link-title";

describe("link title", () => {
  test("prefers the open graph title, then twitter, then the document title", () => {
    expect(pageTitleFromHtml('<meta property="og:title" content="The Word &amp; the world"><title>Ignored</title>')).toBe(
      "The Word & the world",
    );
    expect(pageTitleFromHtml('<meta name="twitter:title" content="A thread"><title>Other</title>')).toBe("A thread");
    expect(pageTitleFromHtml("<title>  Study   notes </title>")).toBe("Study notes");
    expect(pageTitleFromHtml("<p>no title</p>")).toBeNull();
  });

  test("hostname is the fallback and private hosts are not fetched", async () => {
    expect(hostnameLabel("https://www.example.com/study")).toBe("example.com");
    expect(publicHttpUrl("http://127.0.0.1/secret")).toBeNull();
    expect(publicHttpUrl("https://169.254.169.254/latest")).toBeNull();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("<title>nope</title>", { status: 200 });
    }) as typeof fetch;
    const blocked = await resolveLinkTitle("http://localhost/admin", fetchImpl);
    expect(blocked.fallback).toBe(true);
    expect(calls).toBe(0);
  });

  test("a page title replaces the hostname", async () => {
    const fetchImpl = (async () =>
      new Response('<meta property="og:title" content="Grace Abounding">', {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const titled = await resolveLinkTitle("https://example.com/study", fetchImpl);
    expect(titled).toEqual({ title: "Grace Abounding", fallback: false });
  });

  test("a failed fetch keeps the hostname", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const titled = await resolveLinkTitle("https://example.com/study", fetchImpl);
    expect(titled).toEqual({ title: "example.com", fallback: true });
  });
});
