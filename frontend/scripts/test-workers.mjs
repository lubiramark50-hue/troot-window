import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";

const source = readFileSync(new URL("../src/workers.ts", import.meta.url), "utf8");
const isolated = source.replace(/^import .+;\s*$/gm, "");
const transpiled = ts.transpileModule(isolated, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function("exports", "require", transpiled)(exports, createRequire(import.meta.url));
const { matchesWorker, rankWorkers, contactPhone, whatsappUrl, safeImageUrl } = exports;
const make = (o = {}) => ({
  id: "11111111-2222-4333-8444-555555555555",
  display_name: "Worker", country_code: "UG", town: "Kampala",
  services: ["Plumbing"], travel_mode: "mobile", service_areas: ["Wakiso"],
  ...o,
});
assert(matchesWorker(make(), { country:"UG", service:"Plumbing", town:"Kampala" }));
assert(matchesWorker(make(), { country:"UG", service:"Plumbing", town:"Kampala Capital City" }));
assert(matchesWorker(make(), { country:"UG", service:"Plumbing", town:"wAKiso" }));
assert(!matchesWorker(make(), { country:"KE", service:"Plumbing", town:"Kampala" }));
assert(!matchesWorker(make(), { country:"UG", service:"Mechanic", town:"Kampala" }));
assert(!matchesWorker(make({ travel_mode:"fixed" }), { country:"UG", service:"Plumbing", town:"Wakiso" }));
assert(!matchesWorker(make(), { country:"UG", service:"Plumbing", town:"Entebbe" }));
assert(matchesWorker(make(), { country:"UG", service:"Plumbing", town:"" }));
const ranked = rankWorkers([make({ display_name:"Remote", town:"Entebbe", service_areas:["Kampala"] }), make({ display_name:"Local" }), make({ display_name:"Outside", town:"Nairobi", country_code:"KE" })],
{ country:"UG", service:"Plumbing", town:"Kampala" });
assert.deepEqual(ranked.map(x => x.display_name), ["Local","Remote"]);
assert.equal(contactPhone("+256 700 111 222"), "+256700111222");
assert.equal(contactPhone("javascript:alert(1)"), null);
assert.equal(whatsappUrl("+256 700 111 222"), "https://wa.me/256700111222");
assert.equal(whatsappUrl("0700000000"), null);
assert.equal(safeImageUrl("javascript:alert(1)"), undefined);
assert.equal(safeImageUrl("http://example.com/private.jpg"), undefined);
assert.equal(safeImageUrl("https://example.com/photo.jpg"), "https://example.com/photo.jpg");
const migration = readFileSync(new URL("../supabase/migrations/202610230001_find_workers.sql", import.meta.url), "utf8");
assert.match(migration, /row level security/i);
assert.match(migration, /worker_owner_select/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /where is_active = true/);
assert.doesNotMatch(migration.split("create or replace view public.worker_directory")[1].split("revoke all on public.worker_directory")[0], /\buser_id\b|\bemail\b/i);
console.log("PASS: worker matching, location modes, contact safety and public-directory privacy contract");

