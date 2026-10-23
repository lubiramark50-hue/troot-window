import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const expected = process.env.EXPECTED_COMMIT;
assert.match(expected || "", /^[a-f0-9]{40}$/i, "Provide an exact EXPECTED_COMMIT");
const base = process.env.CLOUDFLARE_BASE_URL || "https://troot-window.pages.dev";
assert.match(base, /^https:\/\/([a-z0-9-]+\.)?troot-window\.pages\.dev\/?$/, "Only this project's Pages HTTPS origins are allowed");
let observed = "unavailable";
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/version.json?t=${Date.now()}`, {
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const body = await r.json(); observed = body.commit || body.version;
      if (observed === expected) {
        console.log(`PASS: Pages serves expected commit ${expected}`);
        process.exit(0);
      }
    }
  } catch { /* Deployment/DNS may still be propagating. */ }
  if (attempt < 29) await sleep(10000);
}
throw new Error(`Pages did not deploy ${expected}; last observed ${observed}. Refusing to test a stale release.`);
