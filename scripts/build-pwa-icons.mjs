/**
 * Paint the home-screen icons. The mark matches the inline SVG favicon:
 * paper-colored rules on reader ink, full-bleed so iOS can mask the corners.
 *
 *   node scripts/build-pwa-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INK = [0x1c, 0x19, 0x17];
const PAPER = [0xf6, 0xf5, 0xf2];

/** SVG viewBox 16: three rules, stroke 1.4, round caps. */
const LINES = [
  { x1: 4, y: 4.5, x2: 12 },
  { x1: 4, y: 8, x2: 12 },
  { x1: 4, y: 11.5, x2: 9 },
];
const STROKE = 1.4;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

function coverage(px, py, scale) {
  const radius = (STROKE / 2) * scale;
  let nearest = Infinity;
  for (const line of LINES) {
    const d = distToSegment(px, py, line.x1 * scale, line.y * scale, line.x2 * scale, line.y * scale);
    if (d < nearest) nearest = d;
  }
  const edge = nearest - radius;
  if (edge <= -0.6) return 1;
  if (edge >= 0.6) return 0;
  const t = (edge + 0.6) / 1.2;
  return 1 - t * t * (3 - 2 * t);
}

function png(size) {
  const scale = size / 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const cover = coverage(x + 0.5, y + 0.5, scale);
      const i = row + 1 + x * 4;
      raw[i] = Math.round(INK[0] + (PAPER[0] - INK[0]) * cover);
      raw[i + 1] = Math.round(INK[1] + (PAPER[1] - INK[1]) * cover);
      raw[i + 2] = Math.round(INK[2] + (PAPER[2] - INK[2]) * cover);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../assets/icons");
mkdirSync(outDir, { recursive: true });
const files = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];
for (const [name, size] of files) {
  const file = path.join(outDir, name);
  writeFileSync(file, png(size));
  process.stdout.write(`${file} ${size}x${size}\n`);
}
