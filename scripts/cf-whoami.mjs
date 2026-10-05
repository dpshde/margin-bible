import fs from "node:fs";

const raw = fs.readFileSync(0, "utf8");
const data = JSON.parse(raw.slice(raw.indexOf("{")));
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const ids = Array.isArray(data.accounts) ? data.accounts.map((item) => item.id) : [];
if (!data.authenticated || data.tokenValid === false || !ids.includes(account)) {
  console.error("Cloudflare credential cannot see the account in cloudflare.config.ts");
  process.exit(1);
}
console.log(JSON.stringify({ authenticated: true, email: data.email ?? null, account }));
