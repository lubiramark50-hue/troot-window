import { readFileSync } from "node:fs";
const reportPath = process.argv[2];
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const summary = report.metadata?.vulnerabilities ?? {};
console.log("NPM AUDIT SUMMARY:", JSON.stringify(summary));
for (const [name, advisory] of Object.entries(report.vulnerabilities ?? {})) {
  const via = (advisory.via ?? []).map((item) => typeof item === "string" ? item : `${item.title ?? item.name ?? "advisory"} (${item.url ?? "no URL"})`).join("; ");
  console.log(`${String(advisory.severity).toUpperCase()} ${name}: direct=${advisory.isDirect} range=${advisory.range} fixAvailable=${JSON.stringify(advisory.fixAvailable)} via=${via}`);
}
if (!Object.keys(report.vulnerabilities ?? {}).length) console.log("No npm advisories found.");
