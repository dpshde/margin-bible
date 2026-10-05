/**
 * Preview process for hosts that are not Cloudflare Workers.
 * Same Hono app, sqlite instead of D1, files instead of the asset binding.
 */
import app from "./index";
import { previewAssets } from "./preview-assets";
import { openPreviewDatabase } from "./preview-d1";

const port = Number(process.env.PORT || 8787);
const db = openPreviewDatabase(process.env.PREVIEW_DB || "/tmp/margin-preview.sqlite");

const env = {
  DB: db,
  ASSETS: previewAssets(),
  AUTH_PEPPER: process.env.AUTH_PEPPER || "margin-verse-groups-preview",
};

const executionCtx = {
  waitUntil(promise: Promise<unknown>) {
    promise.catch((err) => {
      console.error(JSON.stringify({ msg: "preview_wait_until", error: err instanceof Error ? err.message : String(err) }));
    });
  },
  passThroughOnException() {},
};

Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch(request) {
    return app.fetch(request, env, executionCtx as ExecutionContext);
  },
});

console.log(JSON.stringify({ msg: "preview_listening", port }));
