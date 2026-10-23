import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const root = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const schema = read("../supabase/schema.sql");
const netlify = root("netlify.toml");
const publishHeaders = read("../public/_headers");
const deploy = root(".github/workflows/deploy-netlify.yml");
const ci = root(".github/workflows/frontend-ci.yml");
const lock = JSON.parse(read("../package-lock.json"));

function check(condition, message) {
  assert.ok(condition, message);
}

// A React/Vite SPA does not need React Server Components. Fail closed if
// the server-side packages vulnerable to React RSC advisories enter the tree.
const rsc = Object.keys(lock.packages ?? {}).filter((name) =>
  ["react-server-dom-webpack", "react-server-dom-parcel", "react-server-dom-turbopack"]
    .some((pkg) => name.endsWith("node_modules/" + pkg)));
check(rsc.length === 0, `Review React Server Components dependencies: ${rsc.join(", ")}`);

// External job descriptions may be HTML, but never executable raw HTML.
const jobContent = read("../src/JobContent.tsx");
check(!jobContent.includes("dangerouslySetInnerHTML"), "Job content must stay safely rendered as React elements");
check(jobContent.includes('const OMIT = new Set(['), "Untrusted formatting must filter active content");
check(jobContent.includes('parsed.protocol === "https:"'), "Links must be scheme-validated");

// A public RPC endpoint must never expose SECURITY DEFINER maintenance routines.
for (const signature of [
  "close_expired_jobs()", "is_trusted_source(text)", "caller_hash()",
  "jobs_before_insert()", "jobs_before_update()", "reports_before_insert()",
]) {
  check(schema.includes(`revoke all on function public.${signature} from public, anon, authenticated;`),
    `Missing PUBLIC/anon/authenticated EXECUTE revoke: ${signature}`);
}
for (const signature of ["ingest_external_jobs(jsonb)", "close_stale_external_jobs(interval)"]) {
  check(schema.includes(`revoke all on function public.${signature} from public;`),
    `Missing PUBLIC revoke: ${signature}`);
  check(schema.includes(`revoke all on function public.${signature} from anon, authenticated;`),
    `Missing API-role revoke: ${signature}`);
}
check((schema.match(/pg_advisory_xact_lock/g) ?? []).length >= 3,
  "Concurrent anonymous inserts must serialize rate-limit and duplicate checks");
check(schema.includes("alter table public.jobs enable row level security;"), "jobs RLS must be on");
check(schema.includes("alter table public.job_reports enable row level security;"), "reports RLS must be on");

for (const token of [
  "Content-Security-Policy", "frame-ancestors 'none'", "object-src 'none'",
  "script-src 'self'", "X-Frame-Options", "Strict-Transport-Security",
  "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy",
]) {
  check(netlify.includes(token), `Missing Netlify config protection: ${token}`);
  check(publishHeaders.includes(token), `Missing published _headers protection: ${token}`);
}
for (const content of [netlify, publishHeaders]) {
  check(content.includes("https://nominatim.openstreetmap.org"), "Allow consent-based backup town lookup endpoint");
  check(content.includes("https://api.bigdatacloud.net"), "Allow consent-based primary town lookup endpoint");
  check(content.includes("geolocation=(self)"), "Allow same-origin optional geolocation prompts");
  check(content.includes("img-src 'self' data: https:"), "Allow HTTPS worker photos without weakening script-src");
}
check(!netlify.includes("unsafe-eval"), "Never allow eval in the production CSP");
check(deploy.includes("npm ci"), "Production must install from lockfile");
check(deploy.includes("npm audit --omit=dev --audit-level=high"), "Audit production dependencies");
check(!deploy.includes("netlify-cli@latest"), "Pin the deployment CLI");
check(ci.includes("npm ci"), "CI must install from lockfile");

console.log("Security static checks passed.");
