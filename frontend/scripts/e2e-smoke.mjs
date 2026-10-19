import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.PREVIEW_URL;
if (!base || !/^https:\/\//i.test(base)) throw new Error("PREVIEW_URL must be an HTTPS draft URL.");
const baseUrl = base.endsWith("/") ? base.slice(0, -1) : base;
const out = "test-results";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(".workspace").waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("heading", { name: "Find work near you" }).waitFor({ state: "visible" });
  await page.evaluate(() => localStorage.removeItem("troot:saved"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".workspace").waitFor({ state: "visible", timeout: 30000 });
  await page.screenshot({ path: `${out}/desktop-home.png`, fullPage: true });

  // Category selection must round-trip through the shareable URL.
  await page.getByRole("button", { name: "Construction", exact: true }).click();
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get("c") === "Construction", null, { timeout: 10000 });
  await page.getByRole("button", { name: "All", exact: true }).first().click();
  await page.waitForFunction(() => !new URL(window.location.href).searchParams.has("c"), null, { timeout: 10000 });

  // Test save/remove and detail navigation when this draft has published listings.
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll(".job-row:not(.skeleton)").length;
    const state = document.querySelector(".state h3")?.textContent?.trim() ?? "";
    return rows > 0 || state === "No jobs match" || state === "Couldn't load jobs";
  }, null, { timeout: 15000 });
  const firstJob = page.locator(".job-row:not(.skeleton)").first();
  if (await firstJob.count()) {
    const title = (await firstJob.locator("h3").innerText()).trim();
    await firstJob.locator(".save-btn").click();
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem("troot:saved") || "[]").length > 0; }
      catch { return false; }
    }, null, { timeout: 10000 });

    await page.goto(`${baseUrl}/saved`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: title, exact: true }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Remove from saved" }).first().click();
    await page.getByText("Nothing saved yet", { exact: true }).waitFor({ timeout: 10000 });

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace").waitFor({ state: "visible" });
    await page.locator(".job-row:not(.skeleton) .job-row-main").first().click();
    await page.locator(".detail-head h2").waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Back" }).click();
    await page.locator(".workspace").waitFor({ state: "visible" });
    console.log("PASS: save/remove, saved jobs, job details, and back navigation.");
  } else {
    console.log("SKIP: save/detail flow because the draft preview has no published job rows.");
  }

  // Search and category filters must remain usable when the result list is empty.
  await page.getByRole("searchbox", { name: "Search jobs" }).fill("troot-e2e-no-match-9f21");
  await page.getByText("No jobs match", { exact: true }).waitFor({ timeout: 15000 });
  await page.locator("details.advanced-filters summary").click();
  await page.getByLabel("Pay period").selectOption("Monthly");
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get("period") === "Monthly", null, { timeout: 10000 });
  await page.screenshot({ path: `${out}/desktop-filters.png`, fullPage: true });

  // The period filter is independent of salary bounds and must round-trip in the URL.
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.waitForFunction(() => !new URL(window.location.href).searchParams.has("period"), null, { timeout: 10000 });
  await page.goto(`${baseUrl}/?smin=-10&smax=Infinity&period=Monthly`, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace").waitFor({ state: "visible" });
  await page.locator("details.advanced-filters summary").click();
  if (await page.getByLabel("Minimum pay").inputValue() !== "") throw new Error("Negative salary query parameter was not sanitized.");
  if (await page.getByLabel("Maximum pay").inputValue() !== "") throw new Error("Non-finite salary query parameter was not sanitized.");
  await page.waitForFunction(() => {
    const u = new URL(window.location.href);
    return !u.searchParams.has("smin") && !u.searchParams.has("smax");
  }, null, { timeout: 10000 });

  // Responsive layout should not overflow horizontally on a narrow phone viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace").waitFor({ state: "visible" });
  await page.locator(".tabbar").waitFor({ state: "visible" });
  await page.locator(".tab.on[aria-current='page']").waitFor({ state: "visible" });
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  if (dimensions.scroll > dimensions.client + 1) throw new Error(`Horizontal overflow at mobile width: ${JSON.stringify(dimensions)}`);
  await page.screenshot({ path: `${out}/mobile-home.png`, fullPage: true });

  // Invalid form submission must show validation errors and must not create a job.
  await page.goto(`${baseUrl}/post`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Post job", exact: true }).click();
  const alertCount = await page.locator('[role="alert"]').count();
  if (alertCount < 1) throw new Error("Empty job form did not display validation errors.");
  await page.screenshot({ path: `${out}/post-validation.png`, fullPage: true });

  // Messaging page should render without creating or sending any messages.
  await page.goto(`${baseUrl}/messages`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Messages" }).waitFor({ state: "visible" });
  await page.screenshot({ path: `${out}/messages.png`, fullPage: true });

  // Safety guidance must remain reachable from the public navigation.
  await page.goto(`${baseUrl}/safety`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Safety", exact: true }).waitFor({ state: "visible" });
  await page.getByText("Never pay to get a job", { exact: true }).waitFor({ state: "visible" });

  // Admin route must render a restricted sign-in screen without an account.
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Review job submissions" }).waitFor({ state: "visible" });
  await page.getByLabel("Email").waitFor({ state: "visible" });
  await page.getByLabel("Password").waitFor({ state: "visible" });
  await page.screenshot({ path: `${out}/admin-login.png`, fullPage: true });

  if (pageErrors.length) throw new Error(`Uncaught browser errors: ${pageErrors.join(" | ")}`);
  console.log("PASS: desktop layout, category URL sync, search, period URL sync, invalid salary URL sanitization, mobile overflow and active tab, form validation, messages, safety, and admin access screen.");
} finally {
  await browser.close();
}
