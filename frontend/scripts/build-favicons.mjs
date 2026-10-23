import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Generate every web favicon from the original Troot Window TW logo.
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const logo = await readFile(path.join(publicDir, "troot-window-logo.webp"));
const sizes = [16, 32, 48, 128, 192, 512];
const rendered = new Map();
for (const size of sizes) {
  const bytes = await sharp(logo).resize(size, size, { fit: "contain" }).png({ compressionLevel: 9 }).toBuffer();
  rendered.set(size, bytes);
  const name = size === 128 ? "favicon.png" : size >= 192 ? "icon-" + size + ".png" : "favicon-" + size + ".png";
  await writeFile(path.join(publicDir, name), bytes);
  console.log("generated", name);
}
// A genuine ICO file with embedded PNG artwork at three browser tab sizes.
const icoSizes = [16, 32, 48];
const header = Buffer.alloc(6 + icoSizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
for (let i = 0; i < icoSizes.length; i++) {
  const size = icoSizes[i], entry = 6 + i * 16, png = rendered.get(size);
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await writeFile(path.join(publicDir, "favicon.ico"), Buffer.concat([header, ...icoSizes.map(size => rendered.get(size))]));
console.log("generated favicon.ico");
