import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.TROOT_BASE_URL || "https://troot-window.pages.dev";
assert.match(base, /^https:\/\/(?:trootwindow\.rentpay\.site|(?:[a-z0-9-]+\.)?troot-window\.pages\.dev)$/);
const artifacts = process.env.ARTIFACT_DIR || "test-results/cloudflare";
await mkdir(artifacts, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });
const scenarios = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

try {
  for (const viewport of scenarios) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const fatalErrors = [];
    page.on("pageerror", error => fatalErrors.push(error.message));
    // Fresh browser contexts and read-only live API calls: never create or
    // modify production accounts, jobs or reports during this smoke test.
    const writes = [];
    await page.route("https://wftjesokdmjzixshjcwf.supabase.co/**", route => {
      const request = route.request();
      const rpcRead = request.method() === "POST" && new URL(request.url()).pathname === "/rest/v1/rpc/search_public_workers";
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && !rpcRead) {
        writes.push(request.method() + " " + new URL(request.url()).pathname);
        return route.abort();
      }
      return route.continue();
    });

    const navigate = async path => {
      const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      assert.equal(response?.status(), 200, `${viewport.name}: HTTP error on ${path}`);
      await page.locator(".tw-app-shell").waitFor({ timeout: 20000 });
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      assert(horizontalOverflow <= 4, `${viewport.name}: horizontal overflow (${horizontalOverflow}px) on ${path}`);
      assert.equal(await page.getByText("Setup needed", { exact: true }).count(), 0,
        `${viewport.name}: Supabase frontend config missing on ${path}`);
    };

    await navigate("/");
    await page.locator("#tw-hero-title").waitFor({ timeout: 15000 });
    await page.waitForFunction(() => document.querySelector(".tw-skeleton-list") === null, null, { timeout: 20000 });
    assert.equal(await page.getByRole("heading", { name: "Couldn't load jobs" }).count(), 0,
      `${viewport.name}: live job listing request failed`);
    await page.locator(".job-row-main").first().waitFor({ timeout: 20000 });
    const detailPath = await page.locator(".job-row-main").first().getAttribute("href");
    await page.locator(".job-row .save-btn").first().click();
    await navigate("/saved");
    await page.locator(`a[href="${detailPath}"]`).first().waitFor({ timeout: 20000 });
    await navigate(detailPath);
    await page.locator(".detail-head").waitFor({ timeout: 20000 });
    await page.screenshot({ path: path.join(artifacts, `${viewport.name}-job.png`), fullPage: true });
    await navigate("/");
    await page.getByRole("searchbox", { name: "Search jobs" }).fill("remote");
    await page.waitForURL(url => url.searchParams.get("q") === "remote");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("searchbox", { name: "Search jobs" }).waitFor();
    assert.equal(await page.getByRole("searchbox", { name: "Search jobs" }).inputValue(), "remote");

    await navigate("/workers");
    await page.locator(".worker-panel").waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole("heading", { name: "Find a worker" }).count(), 1);
    if (viewport.name === "desktop") {
      assert(await page.locator(".tw-sidebar").isVisible(), "Desktop navigation missing");
    } else {
      assert(await page.locator(".tabbar").isVisible(), "Mobile navigation missing");
    }

    await navigate("/post");
    await page.locator("main.viewport").waitFor({ timeout: 20000 });
    await navigate("/workers/account");
    await page.getByRole("heading", { name: "Worker sign in" }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "New worker? Register" }).click();
    await page.getByRole("heading", { name: "Register as a worker" }).waitFor();
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByRole("heading", { name: "Recover your password" }).waitFor();
    await page.screenshot({ path: path.join(artifacts, `${viewport.name}-account.png`), fullPage: true });

    assert.deepEqual(fatalErrors, [], `${viewport.name}: uncaught browser errors`);
    assert.deepEqual(writes, [], "No production writes are permitted");
    results.push({ viewport: viewport.name, base, detailPath, jobs: true, savedJobs: true, searchReload: true, workers: true, authForms: true, errors: fatalErrors, writes });
    console.log(`PASS: ${viewport.name} jobs/details/saved/search, workers, auth forms, responsive navigation; no production writes`);
    await context.close();
  }
} finally {
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
