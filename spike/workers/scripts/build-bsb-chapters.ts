import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { bookCodes, chapterCount } from "../src/books";
import { packChapter, type UsjDocument } from "../src/usj";

const root = path.join(import.meta.dir, "..");
const outDir = path.join(root, "assets/bsb");
const vendorUsj = path.resolve(root, "../../vendor/scripture/bsb/usj");
const cacheZip = path.join(root, ".cache/bsb_usj.zip");
const officialZip = "https://bereanbible.com/bsb_usj.zip";

const source = vendorUsjReady() ? "vendor/scripture/bsb/usj" : officialZip;
const books = loadBooks();

mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
  if (file.endsWith(".json")) rmSync(path.join(outDir, file));
}

let chapters = 0;
let verses = 0;
for (const [code, doc] of books) {
  const expected = chapterCount(code);
  for (let chapter = 1; chapter <= expected; chapter += 1) {
    const pack = packChapter(code, chapter, doc, source);
    if (!pack || pack.verses.length === 0) {
      throw new Error(`missing BSB text for ${code} ${chapter}`);
    }
    const slug = `${code.toLowerCase()}.${chapter}`;
    writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(pack));
    chapters += 1;
    verses += pack.verses.length;
  }
}

const expectedChapters = bookCodes().reduce((sum, code) => sum + chapterCount(code), 0);
if (chapters !== expectedChapters || chapters < 1000) {
  throw new Error(`unexpected chapter count ${chapters} (wanted ${expectedChapters})`);
}

const john = JSON.parse(readFileSync(path.join(outDir, "jhn.3.json"), "utf8")) as {
  verses: Array<{ v: number; text: string; heading?: string }>;
};
const verse16 = john.verses.find((verse) => verse.v === 16);
const verse1 = john.verses.find((verse) => verse.v === 1);
if (!verse16?.text.includes("For God so loved the world")) {
  throw new Error("John 3:16 did not match the BSB pack");
}
if (!verse1?.heading?.includes("Nicodemus")) {
  throw new Error("John 3 pericope heading missing");
}

writeFileSync(
  path.join(outDir, "NOTICE"),
  [
    "Berean Standard Bible (BSB)",
    "Public domain as of 2023-04-30 (Berean Bible Translation Committee / Bible Hub).",
    `Source: ${source}`,
    "Each *.json file is one chapter, flattened with the same verse-row rules as Margin::Usj.pack_chapter.",
    "Disposable cache. Verse text is never merged into notes.",
    "",
  ].join("\n"),
);

console.log(`Wrote ${chapters} chapters, ${verses} verses, source=${source}`);

function vendorUsjReady(): boolean {
  return existsSync(path.join(vendorUsj, "JHN.usj")) || existsSync(path.join(vendorUsj, "JHN.usj.gz"));
}

function loadBooks(): Map<string, UsjDocument> {
  if (vendorUsjReady()) return readVendor();
  return readZip();
}

function readVendor(): Map<string, UsjDocument> {
  const found = new Map<string, UsjDocument>();
  for (const name of readdirSync(vendorUsj)) {
    const match = /^([1-3]?[A-Z]{2,3})\.usj(?:\.gz)?$/.exec(name);
    if (!match) continue;
    const bytes = readFileSync(path.join(vendorUsj, name));
    const json = name.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
    found.set(match[1], JSON.parse(json) as UsjDocument);
  }
  assertBooks(found);
  return found;
}

function readZip(): Map<string, UsjDocument> {
  mkdirSync(path.dirname(cacheZip), { recursive: true });
  if (!existsSync(cacheZip)) {
    console.log(`Fetching ${officialZip}`);
    const response = execFileSync("curl", ["-fsSL", "-o", cacheZip, officialZip], { stdio: "inherit" });
    void response;
  }
  const listing = execFileSync("unzip", ["-Z1", cacheZip], { encoding: "utf8" });
  const found = new Map<string, UsjDocument>();
  for (const entry of listing.split("\n")) {
    const match = /(?:^|\/)([1-3]?[A-Z]{2,3})\.usj$/.exec(entry.trim());
    if (!match) continue;
    const json = execFileSync("unzip", ["-p", cacheZip, entry.trim()], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    found.set(match[1], JSON.parse(json) as UsjDocument);
  }
  assertBooks(found);
  return found;
}

function assertBooks(found: Map<string, UsjDocument>): void {
  const missing = bookCodes().filter((code) => !found.has(code));
  if (missing.length > 0) throw new Error(`USJ missing books: ${missing.join(", ")}`);
  for (const doc of found.values()) {
    if (doc.type !== "USJ") throw new Error("invalid USJ root");
  }
}
