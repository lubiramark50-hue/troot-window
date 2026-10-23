import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import sharp from "sharp";
const dir = new URL("../public/", import.meta.url);
const read = name => readFileSync(new URL(name, dir));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(read("site.webmanifest").toString("utf8"));
const ico = read("favicon.ico");
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1, "ICO format, not HTML");
assert.equal(ico.readUInt16LE(4), 3);
for (const [i, dimension] of [16, 32, 48].entries()) {
  const entry = 6 + i * 16;
  assert.equal(ico[entry], dimension);
  assert.equal(ico[entry + 1], dimension);
  const size = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  assert(offset + size <= ico.length);
  assert.deepEqual(ico.subarray(offset, offset + 8), Buffer.from([137,80,78,71,13,10,26,10]));
}
for (const dimension of [16, 32, 48, 128, 192, 512]) {
  const name = dimension === 128 ? "favicon.png" : dimension >= 192 ? "icon-" + dimension + ".png" : "favicon-" + dimension + ".png";
  const metadata = await sharp(read(name)).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, dimension);
  assert.equal(metadata.height, dimension);
  assert(statSync(new URL(name, dir)).size > 100);
}
for (const name of ["favicon.ico", "favicon-32.png", "favicon-16.png", "apple-touch-icon.png", "site.webmanifest"]) {
  assert(html.includes("/" + name + "?v=20261023"), "Missing versioned favicon link: " + name);
}
assert(manifest.icons.some(icon => icon.sizes === "192x192"));
assert(manifest.icons.some(icon => icon.sizes === "512x512"));
assert.equal(manifest.name, "Troot Window");
assert(read("troot-window-logo.webp").length > 4000, "Expected actual Troot Window artwork");
assert(read("sitemap.xml").toString("utf8").includes("/workers</loc>"));
console.log("PASS: real favicon.ico, 16/32/48/128/192/512 logos, manifest, links and sitemap.");
