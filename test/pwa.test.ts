import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import app from "../src/index";
import type { Env } from "../src/index";
import { page } from "../src/html";
import { renderLoginPage } from "../src/login-page";
import { renderChapterPage, renderMissing, renderNotesIndex } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import { READER_PAPER, webAppManifest } from "../src/pwa";
import type { ChapterPack } from "../src/usj";

const pack = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
) as ChapterPack;
const passage = parsePassage("jhn.3")!;

function anchors(html: string): string[] {
  return html.match(/<a\b[^>]*>/g) ?? [];
}

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect(bytes[0]).toBe(137);
  expect(bytes[1]).toBe(80);
  expect(bytes[2]).toBe(78);
  expect(bytes[3]).toBe(71);
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

function diskAssets(): Fetcher {
  return {
    fetch: async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const file = path.join(import.meta.dir, "../assets", url.pathname);
      if (!existsSync(file)) return new Response("missing", { status: 404 });
      return new Response(readFileSync(file));
    },
  };
}

describe("installable web app", () => {
  test("manifest names Margin and scopes the whole origin", () => {
    const manifest = webAppManifest();
    expect(manifest.name).toBe("Margin");
    expect(manifest.short_name).toBe("Margin");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.id).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe(READER_PAPER);
    expect(manifest.background_color).toBe(READER_PAPER);
    expect(manifest.theme_color).toBe("#f6f5f2");
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/apple-touch-icon.png",
    ]);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.purpose).toBe("any");
    }
  });

  test("every HTML shell links the manifest and a touch icon, without renaming the page", () => {
    const pages = [
      renderChapterPage({ passage, pack, notes: [] }),
      renderNotesIndex([], "jhn.1"),
      renderLoginPage({}),
      renderLoginPage({ signedIn: true }),
      renderMissing("Missing"),
      page("John 1 · Margin", "<p>Hi</p>"),
    ];
    for (const html of pages) {
      expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
      expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
      expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Margin">');
      expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
      expect(html).toContain('content="#f6f5f2"');
    }
    expect(pages[0]).toContain("<title>John 3 · Margin</title>");
    expect(pages[1]).toContain("<title>Notes · Margin</title>");
    expect(pages[0]).not.toContain("<title>Margin</title>");
  });

  test("same-origin chapter links stay in the app; route.bible stays external", () => {
    const html = renderChapterPage({ passage, pack, notes: [] });
    const tags = anchors(html);
    const chapters = tags.filter((tag) => /href="\/[a-z0-9]+\.\d+/.test(tag));
    expect(chapters.length).toBeGreaterThan(0);
    for (const tag of chapters) expect(tag).not.toContain("target=");
    const notes = tags.filter((tag) => tag.includes('href="/notes"'));
    expect(notes.length).toBeGreaterThan(0);
    for (const tag of notes) expect(tag).not.toContain("target=");
    const profile = tags.filter((tag) => /href="\/login(?:\?[^"]*)?"/.test(tag));
    expect(profile.length).toBeGreaterThan(0);
    for (const tag of profile) expect(tag).not.toContain("target=");
    const route = tags.filter((tag) => tag.includes("https://route.bible/"));
    expect(route.length).toBeGreaterThan(0);
    for (const tag of route) expect(tag).toContain('target="_blank"');
  });

  test("manifest.webmanifest and manifest.json both return the install manifest", async () => {
    const web = await app.request("http://margin.test/manifest.webmanifest");
    const json = await app.request("http://margin.test/manifest.json");
    expect(web.status).toBe(200);
    expect(json.status).toBe(200);
    expect(web.headers.get("content-type")).toContain("application/manifest+json");
    expect(json.headers.get("content-type")).toContain("application/manifest+json");
    expect(await web.json()).toEqual(webAppManifest());
    expect(await json.json()).toEqual(webAppManifest());
  });

  test("png icons and apple-touch-icon return 200", async () => {
    const env = { ASSETS: diskAssets() } as Env;
    const expected: Array<[string, number]> = [
      ["/icons/icon-192.png", 192],
      ["/icons/icon-512.png", 512],
      ["/icons/apple-touch-icon.png", 180],
      ["/apple-touch-icon.png", 180],
      ["/apple-touch-icon-precomposed.png", 180],
    ];
    for (const [pathname, size] of expected) {
      const res = await app.request(`http://margin.test${pathname}`, {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(pngSize(bytes)).toEqual({ width: size, height: size });
    }
    const missing = await app.request("http://margin.test/icons/missing.png", {}, env);
    expect(missing.status).toBe(404);
  });
});
