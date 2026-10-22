/** Tests job descriptions and posting from the compiled web app with an isolated mocked Supabase API. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";

const port = 4179;
const origin = `http://127.0.0.1:${port}`;
const id = "11111111-2222-4333-8444-555555555555";
const job = {
  id, title: "Community technology assistant", employer_name: "Example Employer",
  location: "Kampala", category: "Technology", mode: "OnSite",
  pay: "UGX 80,000/day", created_at: new Date().toISOString(),
  published_at: new Date().toISOString(), employer_verified: false,
  description: `<div class="intro"><h2>About the role</h2><p>Help our team with <strong>real work</strong>.</p><ul><li>Welcome visitors</li><li>Prepare reports</li></ul><script>window.__injected=true</script><a href="javascript:alert(1)">unsafe link</a><a href="https://example.org/opportunities">External careers</a></div>`,
  requirements: "Good communication, Teamwork", status: "published",
  source: "greenhouse", source_url: "https://example.org/opportunities",
  company_domain: "example.org", phone: null, whatsapp: null, email: null,
};
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "pipe" });
let browser;
let failures = 0;
try {
  let started = false;
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(origin); if (r.ok) { started = true; break; } } catch {}
    await sleep(250);
  }
  assert(started, "Vite preview server did not start");
  browser = await chromium.launch({ headless: true });
  for (const [name, viewport] of [["desktop", { width: 1280, height: 820 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    let shouldReject = false;
    let inserted = null;
    let activeJob = job;
    page.on("pageerror", e => errors.push(e.message));
    // Avoid third-party requests during isolated UI tests; the SVG simulates
    // an available company favicon, including while offline.
    await page.route("https://www.google.com/s2/favicons?**", async route => {
      if (route.request().url().includes("broken-logo.example")) return route.abort("failed");
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#096ee9"/></svg>' });
    });
    await page.route("https://fake.supabase.test/**", async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname !== "/rest/v1/jobs") {
        return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      }
      if (req.method() === "POST") {
        inserted = JSON.parse(req.postData() || "{}");
        return route.fulfill({ status: shouldReject ? 403 : 201, contentType: "application/json", body: JSON.stringify(shouldReject ? { code: "42501", message: "permission denied" } : { id, status: "published" }) });
      }
      if (req.method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: req.headers().accept?.includes("application/vnd.pgrst.object") ? JSON.stringify(activeJob) : JSON.stringify([activeJob]) });
      }
      return route.fulfill({ status: 405, body: "{}" });
    });
    try {
      // Company logo is shared by feed cards and detail pages.
      await page.goto(origin);
      const cardLogo = page.locator(".job-row .company-avatar-img").first();
      await cardLogo.waitFor({ timeout: 20000 });
      assert.equal(new URL(await cardLogo.getAttribute("src")).searchParams.get("domain"), "example.org");
      await page.goto(`${origin}/jobs/${id}`);
      await page.getByRole("heading", { name: "Community technology assistant" }).waitFor();
      const detailLogo = page.locator(".detail-head .company-avatar-img");
      await detailLogo.waitFor();
      assert.equal(new URL(await detailLogo.getAttribute("src")).searchParams.get("domain"), "example.org");
      // A listing syndicated by a third-party board must NOT show the board's
      // logo as if that board employed the candidate.
      activeJob = { ...job, employer_name: "RemotePeople", source: "himalayas", company_domain: "himalayas.app" };
      await page.reload();
      const curatedLogo = page.locator(".detail-head .company-avatar-img");
      await curatedLogo.waitFor();
      assert.equal(await curatedLogo.getAttribute("src"), "/employer-logos/remotepeople.png");
      await page.waitForFunction(() => {
        const img = document.querySelector(".detail-head .company-avatar-img");
        return img && img.complete && img.naturalWidth > 0;
      });
      // The largest employer on the production board must show a legible full
      // company wordmark both on job cards and on the details page.
      activeJob = { ...job, employer_name: "Moniepoint", source: "greenhouse", company_domain: "moniepoint.com" };
      await page.goto(origin);
      const wordmark = page.locator(".job-row .company-avatar-img").first();
      await wordmark.waitFor();
      assert.equal(await wordmark.getAttribute("src"), "/employer-logos/moniepoint.png");
      await page.waitForFunction(() => {
        const img = document.querySelector(".job-row .company-avatar-img");
        return img && img.complete && img.naturalWidth > 0;
      });
      const logoWidth = await page.locator(".job-row .company-avatar").evaluate(el => el.getBoundingClientRect().width);
      assert(logoWidth >= 85, `Company wordmark is too small to read: ${logoWidth}px`);
      await page.goto(`${origin}/jobs/${id}`);
      const detailWordmark = page.locator(".detail-head .company-avatar-img");
      await detailWordmark.waitFor();
      assert.equal(await detailWordmark.getAttribute("src"), "/employer-logos/moniepoint.png");
      activeJob = { ...job, employer_name: "Unknown Employer", source: "jobicy", company_domain: "jobicy.com" };
      await page.reload();
      await page.locator(".detail-head .company-avatar-placeholder").waitFor();
      assert.equal(await page.locator(".detail-head .company-avatar-img").count(), 0, "Never show a third-party job board as the employer");
      assert.equal(await page.locator(".detail-head .company-avatar").innerText(), "", "Fallback icon must replace initials");
      activeJob = { ...job, employer_name: "Broken Logo Co", source: "greenhouse", company_domain: "broken-logo.example" };
      await page.reload();
      await page.locator(".detail-head .company-avatar-placeholder").waitFor();
      assert.equal(await page.locator(".detail-head .company-avatar-img").count(), 0,
        "A failed favicon request must degrade gracefully instead of showing a broken image");
      activeJob = job;
      await page.getByRole("heading", { name: "About the role" }).waitFor();
      const body = await page.locator(".job-rich-content").innerText();
      assert(body.includes("Help our team with real work"));
      assert(body.includes("Welcome visitors"));
      assert(!body.includes("<div") && !body.includes("<strong"), "Raw HTML is visible");
      assert.equal(await page.locator('.job-rich-content a[href^="javascript:"]').count(), 0);
      assert.equal(await page.locator('.job-rich-content a[href="https://example.org/opportunities"]').count(), 1);
      assert.equal(await page.evaluate(() => window.__injected), undefined);
      await page.goto(`${origin}/post`);
      assert.equal(await page.locator('input[name="website"]').count(), 0, "The autofill-prone honeypot must be absent");
      await page.locator('[name="title"]').fill("Community assistant needed");
      await page.locator('[name="employer"]').fill("Example Employer");
      await page.locator('[name="location"]').fill("Kampala");
      await page.locator('[name="pay"]').fill("UGX 50,000/day");
      await page.locator('[name="summary"]').fill("A legitimate job with community support duties and training.");
      await page.locator('[name="requirements"]').fill("Communication, teamwork");
      await page.locator('[name="phone"]').fill("+256 700 000 000");
      shouldReject = true;
      await page.getByRole("button", { name: "Post job" }).click();
      await page.getByRole("alert").filter({ hasText: "database permissions" }).waitFor();
      assert.equal(await page.getByRole("heading", { name: "Your job is live" }).count(), 0);
      shouldReject = false;
      await page.getByRole("button", { name: "Post job" }).click();
      await page.getByRole("heading", { name: "Your job is live" }).waitFor();
      assert.equal(inserted.title, "Community assistant needed");
      assert.equal(inserted.employer_name, "Example Employer");
      assert.equal(inserted.phone, "+256 700 000 000");
      const href = await page.getByRole("button", { name: "View your job" }).getAttribute("type");
      assert(href === null || href === "button");
      assert.deepEqual(errors, [], `Browser errors in ${name}`);
      console.log(`PASS ${name}: full employer wordmarks load on feed/detail; verified aggregator-safe fallback, job detail safety and job posting`);
    } catch (e) {
      failures++;
      console.error(`FAIL ${name}`, e);
    } finally { await page.close(); }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
if (failures) process.exitCode = 1;
