import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const apiTokens = ['from("jobs")', 'from("job_reports")', "employer_name", "status", "published", "salary_min", "salary_max", "salary_currency", "pay_period", "experience_level", "application_deadline"];
for (const t of apiTokens) if (!api.includes(t)) throw new Error("API layer missing: " + t);

const sqlTokens = ["enable row level security", "create policy", "revoke all on public.jobs", "grant insert", "rate_limited", "salary_min", "salary_max", "salary_currency", "pay_period", "experience_level", "application_deadline", "jobs_salary_range_valid"];
for (const t of sqlTokens) if (!sql.toLowerCase().includes(t.toLowerCase())) throw new Error("Schema missing: " + t);

if (/service_role/i.test(readFileSync(new URL("../src/supabase.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "")))
  throw new Error("service_role must never appear in app code.");
const feed = readFileSync(new URL("../src/screens/Feed.tsx", import.meta.url), "utf8");
for (const token of ["advanced-filters", "salaryMin", "experienceLevel", "deadline", "Clear filters"]) {
  if (!feed.includes(token)) throw new Error("Job filter UI missing: " + token);
}
const post = readFileSync(new URL("../src/screens/Post.tsx", import.meta.url), "utf8");
for (const token of ["salaryMin", "salaryMax", "experienceLevel", "applicationDeadline"]) {
  if (!post.includes(token)) throw new Error("Job posting field missing: " + token);
}
console.log("Supabase and structured job-filter contract checks passed.");
