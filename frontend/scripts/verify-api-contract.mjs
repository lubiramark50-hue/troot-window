import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const required = [
  "/api/jobs?",
  "/api/jobs/",
  "method:'POST'",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error("Frontend API contract missing: " + token);
}
console.log("Frontend API contract smoke check passed.");
