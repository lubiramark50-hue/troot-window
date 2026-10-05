import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const apiTokens = ['from("jobs")', 'from("job_reports")', "employer_name", "status", "published"];
for (const t of apiTokens) if (!api.includes(t)) throw new Error("API layer missing: " + t);

const sqlTokens = ["enable row level security", "create policy", "revoke all on public.jobs", "grant insert", "rate_limited"];
for (const t of sqlTokens) if (!sql.toLowerCase().includes(t.toLowerCase())) throw new Error("Schema missing: " + t);

if (/service_role/i.test(readFileSync(new URL("../src/supabase.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "")))
  throw new Error("service_role must never appear in app code.");
console.log("Supabase contract check passed.");
