import { isConfigured, supabase } from "./supabase";

export type WorkMode = "OnSite" | "Hybrid" | "Remote";
export type Job = {
  id: string; title: string; employerName: string; location: string; category: string;
  mode: WorkMode; pay: string; description: string; requirements: string;
  phone?: string; whatsApp?: string; email?: string;
  employerVerified: boolean; createdAt: string; publishedAt?: string;
  /** Set when the listing was synced from an outside source rather than posted here. */
  source?: string;
  sourceUrl?: string;
  companyDomain?: string;
};
export type JobsPage = { items: Job[]; page: number; pageSize: number; totalCount: number; hasNext: boolean };
export type NewJob = {
  title: string; employerName: string; location: string; category: string; mode: WorkMode;
  pay: string; description: string; requirements: string;
  phone: string | null; whatsApp: string | null; email: string | null;
};

export const CATEGORIES = ["Construction", "Technology", "Trades", "Hospitality", "Transport", "Other"] as const;
export const MODES: { value: WorkMode; label: string }[] = [
  { value: "OnSite", label: "On-site" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "Remote", label: "Remote" },
];
export const modeLabel = (m: string) => MODES.find((x) => x.value === m)?.label ?? m;

/** Where a synced listing came from, in words. Kept in step with the sources in
 *  scripts/job-sources.mjs. */
export const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "the employer's careers page",
  lever: "the employer's careers page",
  ashby: "the employer's careers page",
  workable: "the employer's careers page",
  smartrecruiters: "the employer's careers page",
  remotive: "Remotive",
  jobicy: "Jobicy",
  himalayas: "Himalayas",
  arbeitnow: "Arbeitnow",
};
export const sourceLabel = (s?: string) => (s ? SOURCE_LABELS[s] ?? s : "");

const LIST_COLS = "id,title,employer_name,location,category,mode,pay,description,requirements,employer_verified,created_at,published_at,source,source_url,company_domain";
const DETAIL_COLS = LIST_COLS + ",phone,whatsapp,email";
const TIMEOUT_MS = 12000;

type Row = Record<string, any>;
const toJob = (r: Row): Job => ({
  id: r.id, title: r.title, employerName: r.employer_name, location: r.location, category: r.category,
  mode: r.mode, pay: r.pay, description: r.description, requirements: r.requirements,
  phone: r.phone ?? undefined, whatsApp: r.whatsapp ?? undefined, email: r.email ?? undefined,
  employerVerified: !!r.employer_verified, createdAt: r.created_at, publishedAt: r.published_at ?? undefined,
  source: r.source ?? undefined, sourceUrl: r.source_url ?? undefined, companyDomain: r.company_domain ?? undefined,
});

function fail(error: { message?: string; code?: string } | null | undefined): never {
  if (error?.message === "rate_limited") throw new Error("Too many requests from your network. Please wait a few minutes and try again.");
  if (error?.message === "duplicate_job") throw new Error("This job was already posted today. It is already live in the feed.");
  if (error?.code === "23505") throw new Error("You have already reported this job.");
  if (error?.code === "23514" || error?.code === "22001") throw new Error("Some details are not valid. Please review the form.");
  if (error?.code === "42501") throw new Error("This action is not allowed.");
  if (error?.message && /abort/i.test(error.message)) throw new Error("The server took too long to respond. Please try again.");
  if (error?.message && /fetch|network/i.test(error.message)) throw new Error("Could not reach the service. Check your connection and try again.");
  throw new Error("Something went wrong. Please try again.");
}

/**
 * The provenance columns (source, source_url, company_domain) arrive with the
 * job-source sync migration. A deploy that lands before the migration would
 * otherwise break the whole feed, so the first such query falls back to the
 * previous column list and the session remembers it. Delete this once every
 * environment has run the migration.
 */
const PROVENANCE_COLS = ",source,source_url,company_domain";
let provenanceColumns = true;

type QueryResult = { data: any; count?: number | null; error: { code?: string; message?: string } | null };

async function selectWithFallback(
  run: (cols: string) => PromiseLike<QueryResult>,
  cols: string,
): Promise<QueryResult> {
  // Whether to retry depends on the column list this call actually sent, not on the
  // (mutable) flag: two queries can be in flight at once, and the second must still
  // recover when the first discovers the columns are absent.
  const sent = provenanceColumns ? cols : cols.replace(PROVENANCE_COLS, "");
  const res = await run(sent);
  if (res.error?.code === "42703" && sent.includes(PROVENANCE_COLS)) {
    provenanceColumns = false;
    return await run(cols.replace(PROVENANCE_COLS, ""));
  }
  return res;
}

const guard = () => {
  if (!isConfigured) throw new Error("This build is missing its Supabase configuration.");
};
const signal = () => AbortSignal.timeout(TIMEOUT_MS);
const withTimeout = <T,>(p: PromiseLike<T>): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("abort")), TIMEOUT_MS))]);
// Strip characters that carry meaning inside PostgREST filter strings.
const cleanTerm = (q: string) => q.replace(/[%*,()"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export const jobsApi = {
  async list(p: { q?: string; category?: string; mode?: string; verified?: boolean; page?: number; pageSize?: number }): Promise<JobsPage> {
    guard();
    const page = Math.max(1, p.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, p.pageSize ?? 20));
    const term = cleanTerm(p.q ?? "");
    const from = (page - 1) * pageSize;
    const { data, count, error } = await selectWithFallback((cols) => {
      let query = supabase.from("jobs").select(cols, { count: "exact" }).eq("status", "published");
      if (term) {
        const t = `"%${term}%"`;
        query = query.or(["title", "employer_name", "location", "category", "requirements"].map((c) => `${c}.ilike.${t}`).join(","));
      }
      if (p.category && p.category !== "All") query = query.eq("category", p.category);
      if (p.mode && p.mode !== "All") query = query.eq("mode", p.mode);
      if (p.verified) query = query.eq("employer_verified", true);
      return query
        .order("employer_verified", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1)
        .abortSignal(signal());
    }, LIST_COLS);
    if (error) fail(error);
    const total = count ?? 0;
    return { items: (data ?? []).map(toJob), page, pageSize, totalCount: total, hasNext: from + pageSize < total };
  },

  async get(id: string): Promise<Job> {
    guard();
    const { data, error } = await selectWithFallback(
      (cols) => supabase.from("jobs").select(cols).eq("id", id).eq("status", "published").abortSignal(signal()).maybeSingle(),
      DETAIL_COLS,
    );
    if (error) fail(error);
    if (!data) throw new Error("This job is no longer available.");
    return toJob(data);
  },

  async getMany(ids: string[]): Promise<Job[]> {
    guard();
    if (ids.length === 0) return [];
    const { data, error } = await selectWithFallback(
      (cols) => supabase.from("jobs").select(cols).eq("status", "published").in("id", ids.slice(0, 100)).abortSignal(signal()),
      LIST_COLS,
    );
    if (error) fail(error);
    const byId = new Map(((data ?? []) as Row[]).map((r) => [r.id as string, toJob(r)]));
    return ids.map((i) => byId.get(i)).filter((j): j is Job => !!j);
  },

  async report(id: string, body: { reason: string; details?: string }): Promise<void> {
    guard();
    const { error } = await withTimeout(supabase.from("job_reports").insert({ job_id: id, reason: body.reason.slice(0, 60), details: body.details?.slice(0, 1000) || null }));
    if (error) fail(error);
  },

  // No .select() on purpose: the database sets status, verification and expiry server-side.
  async create(job: NewJob): Promise<void> {
    guard();
    const { error } = await withTimeout(supabase.from("jobs").insert({
      title: job.title, employer_name: job.employerName, location: job.location, category: job.category,
      mode: job.mode, pay: job.pay, description: job.description, requirements: job.requirements,
      phone: job.phone, whatsapp: job.whatsApp, email: job.email,
    }));
    if (error) fail(error);
  },
};
