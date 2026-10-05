/** Read chapter JSON and icons from ./assets, the same tree the Worker binding serves. */
export function previewAssets(root = `${process.cwd()}/assets`): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const rel = url.pathname.replace(/^\/+/, "");
      if (!rel || rel.includes("..")) return new Response("not found", { status: 404 });
      const file = Bun.file(`${root}/${rel}`);
      if (!(await file.exists())) return new Response("not found", { status: 404 });
      const type = rel.endsWith(".json")
        ? "application/json; charset=utf-8"
        : rel.endsWith(".png")
          ? "image/png"
          : "application/octet-stream";
      return new Response(file, { headers: { "content-type": type } });
    },
  } as Fetcher;
}
