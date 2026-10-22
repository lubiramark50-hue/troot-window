/** Logic regression tests: logos must represent employers, not aggregator sites. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { Script, createContext } from "node:vm";
import ts from "typescript";

const file = new URL("../src/company-logos.ts", import.meta.url);
const source = readFileSync(file, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  strict: true,
}});
const sandbox = { exports: {} };
new Script(compiled.outputText, { filename: "company-logos.js" }).runInContext(createContext(sandbox));
const { employerLogoDomain, employerLogoUrl, employerWordmarkUrl, employerFaviconUrl } = sandbox.exports;
const job = (source, companyDomain, employerName = "Example Employer") => ({ source, companyDomain, employerName });

assert.equal(employerLogoDomain(job("greenhouse", "moniepoint.com", "Moniepoint")), "moniepoint.com");
assert.equal(employerLogoDomain(job("ashby", "m-kopa.com", "M-KOPA")), "m-kopa.com");
assert.equal(employerLogoDomain(job("himalayas", "himalayas.app", "RemotePeople")), "remotepeople.com");
assert.equal(employerLogoDomain(job("himalayas", "himalayas.app", "ScaleJet")), "scale-jet.com");
assert.equal(employerLogoDomain(job("jobicy", "jobicy.com", "Spotify")), "spotify.com");
assert.equal(employerLogoDomain(job("arbeitnow", "arbeitnow.com", "Rillet")), "rillet.com");
assert.equal(employerLogoDomain(job("remotive", "remotive.com", "Unknown startup")), null);
assert.equal(employerLogoDomain(job("himalayas", "himalayas.app", "Unknown startup")), null);
assert.equal(employerLogoDomain(job(null, "spotify.com", "Spotify")), null,
  "A self-posted job must not be able to impersonate a brand");
assert.equal(employerLogoDomain(job("unexpected", "moniepoint.com", "Moniepoint")), null);
assert.equal(employerLogoDomain(job("greenhouse", "himalayas.app", "Unknown startup")), null);
for (const value of ["example.org/path", "x.example.com?bad=1", "javascript:evil.org", "https://foo.com", "localhost", "x..com"])
  assert.equal(employerLogoDomain(job("greenhouse", value)), null, `Rejected unsafe domain: ${value}`);
assert.equal(employerLogoUrl(job("greenhouse", "moniepoint.com")), "/employer-logos/moniepoint.png");
assert.equal(employerLogoUrl(job("ashby", "m-kopa.com", "M-KOPA")), "/employer-logos/m-kopa.png");
assert.equal(employerLogoUrl(job("himalayas", "himalayas.app", "RemotePeople")), "/employer-logos/remotepeople.png");
assert.equal(employerLogoUrl(job("jobicy", "jobicy.com", "Nebius")), "/employer-logos/nebius.png");
assert.equal(employerLogoUrl(job("arbeitnow", "arbeitnow.com", "Natuvion GmbH")), "/employer-logos/natuvion.png");
assert.equal(employerLogoUrl(job("jobicy", "jobicy.com", "Spotify")),
  "https://www.google.com/s2/favicons?domain=spotify.com&sz=128");
assert.equal(employerWordmarkUrl(job(null, "moniepoint.com", "Moniepoint")), null,
  "Anonymous employer job posts cannot assume identity of a famous employer");
assert.equal(employerFaviconUrl(job("greenhouse", "moniepoint.com")),
  "https://www.google.com/s2/favicons?domain=moniepoint.com&sz=128");
const curated = JSON.parse(readFileSync(new URL("../public/employer-logos/SOURCES.json", import.meta.url), "utf8"));
for (const [filename, source] of Object.entries(curated)) {
  assert(source.url.startsWith("https://"), `Official source required: ${filename}`);
  assert(existsSync(new URL(`../public/employer-logos/${filename}.png`, import.meta.url)),
    `Missing wordmark: ${filename}`);
}
assert(Object.keys(curated).length >= 16, "Expected high-coverage approved employer wordmarks");
console.log("PASS: authentic local employer wordmarks, assets verified, aggregator filtering, domain spoofing prevention and favicon fallback.");
