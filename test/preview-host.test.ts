import { describe, expect, test } from "bun:test";
import app from "../src/index";
import { openPreviewDatabase } from "../src/preview-d1";

const ctx = {
  waitUntil(promise: Promise<unknown>) {
    promise.catch(() => {});
  },
  passThroughOnException() {},
};

describe("preview host", () => {
  test("empty library shows verse groups and a saved title stays on the next request", async () => {
    const env = {
      DB: openPreviewDatabase(":memory:"),
      ASSETS: { fetch: async () => new Response("missing", { status: 404 }) } as Fetcher,
      AUTH_PEPPER: "preview-test",
    };
    const first = await app.fetch(new Request("https://preview.local/notes"), env, ctx as ExecutionContext);
    expect(first.status).toBe(200);
    const html = await first.text();
    expect(html).toContain('id="verse-groups-btn"');
    expect(html).toContain('data-hub="rom.9.17"');
    expect(html).toContain("1 Peter 5:6");
    const setCookie = first.headers.get("set-cookie") ?? "";
    const session = /margin_session=[^;]+/.exec(setCookie)?.[0];
    expect(session).toBeTruthy();

    const save = await app.fetch(
      new Request("https://preview.local/api/verse-groups", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: session! },
        body: JSON.stringify({
          action: "save",
          hub: "rom.9.17",
          title: "Raised up",
          description: "For this purpose",
        }),
      }),
      env,
      ctx as ExecutionContext,
    );
    expect(save.status).toBe(200);
    const saved = (await save.json()) as { ok: boolean; status: string };
    expect(saved.ok).toBe(true);
    expect(saved.status).toBe("Saved.");

    const again = await app.fetch(
      new Request("https://preview.local/notes", { headers: { cookie: session! } }),
      env,
      ctx as ExecutionContext,
    );
    const nextHtml = await again.text();
    expect(nextHtml).toContain("Raised up");
    expect(nextHtml).toContain("For this purpose");
    expect(nextHtml).toContain('data-sample="0"');
    expect(nextHtml).toContain("Esther 4:14");
  });
});
