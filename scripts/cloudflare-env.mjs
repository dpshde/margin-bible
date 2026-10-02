import fs from "node:fs";

const raw = fs.readFileSync("wrangler.jsonc", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const cfg = JSON.parse(raw);
const account = cfg.account_id ?? "";
const id = cfg.d1_databases?.[0]?.database_id ?? "";
const accountOk = /^[a-f0-9]{32}$/.test(account);
const idOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
if (!accountOk || !idOk) {
  console.error("wrangler.jsonc account_id or d1 database_id is missing or unexpected");
  process.exit(1);
}
process.stdout.write(`export CLOUDFLARE_ACCOUNT_ID=${account}\n`);
process.stdout.write(`export D1_ID=${id}\n`);
