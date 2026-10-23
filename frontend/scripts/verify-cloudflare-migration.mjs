import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const headers = read("../public/_headers");
const redirects = read("../public/_redirects");
const html = read("../index.html");
const robots = read("../public/robots.txt");
const sitemap = read("../public/sitemap.xml");

assert.match(headers, /^\/\*\s*\n/m, "Keep the existing global security headers");
for (const item of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"]) {
  assert.ok(headers.includes(item), `Missing published security header: ${item}`);
}
for (const domain of [
  "https://troot-window.pages.dev/*",
  "https://:version.troot-window.pages.dev/*",
]) {
  const section = headers.split(domain + "\n")[1]?.split("\n\n")[0] ?? "";
  assert.match(section, /X-Robots-Tag:\s*noindex/i, `Pages preview hostname must be noindex: ${domain}`);
}
const global = headers.split("/*\n")[1]?.split("\n\n")[0] ?? "";
assert.doesNotMatch(global, /X-Robots-Tag:\s*noindex/i, "Never block Google indexing on the real domain");
assert.doesNotMatch(headers, /https:\/\/trootwindow\.rentpay\.site\/\*\s*\n\s*X-Robots-Tag:\s*noindex/i);
assert.match(html, /<link rel="canonical" href="https:\/\/trootwindow\.rentpay\.site\/"/);
assert.match(html, /<meta property="og:url" content="https:\/\/trootwindow\.rentpay\.site\/"/);
assert.match(robots, /^User-agent:/mi);
assert.match(sitemap, /<urlset\b/);
assert.match(sitemap, /https:\/\/trootwindow\.rentpay\.site\//);
assert.match(redirects, /^\/\*\s+\/index\.html\s+200\s*$/m, "Keep existing React Router deep-link fallback");
for (const name of ["favicon.svg", "favicon.ico", "og.png", "manifest.json"]) {
  assert.ok(existsSync(new URL("../public/" + name, import.meta.url)), `Keep SEO/PWA asset: ${name}`);
}
console.log("PASS: Cloudflare preview noindex is host-only; production SEO, headers and SPA routing remain intact.");
