import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "https://troot-window.pages.dev";
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
    await page.waitForFunction(() => document.querySelector(".tw-skeleton-list") === null, { timeout: 20000 });
    assert.equal(await page.getByRole("heading", { name: "Couldn't load jobs" }).count(), 0,
      `${viewport.name}: live job listing request failed`);

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
    await page.locator(".tw-app-shell").waitFor({ timeout: 15000 });

    assert.deepEqual(fatalErrors, [], `${viewport.name}: uncaught browser errors`);
    console.log(`PASS: ${viewport.name} responsive navigation, anonymous jobs, workers and account routes`);
    await context.close();
  }
} finally {
  await browser.close();
}
