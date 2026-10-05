import fs from "node:fs";
import { pathToFileURL } from "node:url";

const accountPattern = /accountId:\s*"([a-f0-9]{32})"/;
const d1Pattern =
  /bindings\.d1\(\{[\s\S]*?\bid:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/;

export function cloudflareIdsFromSource(source) {
  const account = source.match(accountPattern)?.[1] ?? "";
  const d1Id = source.match(d1Pattern)?.[1] ?? "";
  const accountOk = /^[a-f0-9]{32}$/.test(account);
  const idOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(d1Id);
  if (!accountOk || !idOk) {
    throw new Error("cloudflare.config.ts accountId or d1 database id is missing or unexpected");
  }
  return { account, d1Id };
}

function main() {
  const raw = fs.readFileSync("cloudflare.config.ts", "utf8");
  const { account, d1Id } = cloudflareIdsFromSource(raw);
  process.stdout.write(`export CLOUDFLARE_ACCOUNT_ID=${account}\n`);
  process.stdout.write(`export D1_ID=${d1Id}\n`);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
