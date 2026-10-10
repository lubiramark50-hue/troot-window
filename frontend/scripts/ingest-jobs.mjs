#!/usr/bin/env node
/**
 * Troot Window — job source sync.
 *
 * Pulls live vacancies from (a) approved employers' own applicant-tracking
 * feeds and (b) public remote-job feeds, normalises them onto the `jobs` table
 * contract, and writes a single SQL file that upserts them through
 * `public.ingest_external_jobs(jsonb)`.
 *
 * The sync never touches the anon API key and never runs from the browser: the
 * SQL file is applied over the database connection (SUPABASE_DB_URL), so RLS and
 * the public submission path are untouched.
 *
 *   node scripts/ingest-jobs.mjs --dry-run     # fetch + normalise, write JSON only
 *   node scripts/ingest-jobs.mjs               # also write ingest.sql
 *   node scripts/ingest-jobs.mjs --only=remotive
 *
 * Every listing records where it came from, so the app can show the original
 * posting and never presents a synced vacancy as one of our own.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATS, FEEDS, FEED_CAP } from './job-sources.mjs';
import { mapCategory } from './job-categories.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = 'TrootWindow/1.0 (+https://trootwindow.rentpay.site)';

// The board's categories and how a posting is filed into one live in
// job-categories.mjs, so `npm run test:categories` can check them on real titles
// without this script touching the network.

const AFRICA_OPEN =
  /\b(uganda|kampala|kenya|nairobi|tanzania|dar es salaam|rwanda|kigali|nigeria|lagos|abuja|ghana|accra|south africa|johannesburg|cape town|zambia|lusaka|malawi|mozambique|senegal|dakar|ivory coast|abidjan|cameroon|ethiopia|addis|egypt|cairo|morocco|tunisia|zimbabwe|botswana|namibia|africa|emea|worldwide|anywhere|global|remote)\b/i;

const DOMAIN_ALIASES = [
  [/\bm-?kopa\b/i, 'M-KOPA'],
  [/\bone acre fund\b/i, 'One Acre Fund'],
  [/\beducate!\b/i, 'Educate!'],
];

// ---------------------------------------------------------------- text helpers

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', middot: '·',
  eacute: 'é', egrave: 'è', agrave: 'à', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
  ccedil: 'ç', ntilde: 'ñ', reg: '®', copy: '©', trade: '™', euro: '€', pound: '£',
};

const decodeEntities = (s) =>
  String(s ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });

const toText = (html) =>
  decodeEntities(decodeEntities(String(html ?? '').replace(/<[^>]*>/g, ' ')))
    .replace(/\s+/g, ' ')
    .trim();

const clip = (s, n) => String(s ?? '').trim().slice(0, n);

const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

const joinList = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : v ? String(v) : '');

/** Best-effort origin so the app can show where a listing lives. */
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function mapMode(...candidates) {
  const haystack = candidates.filter(Boolean).join(' ');
  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid';
  if (/\b(remote|home ?office|telecommut|anywhere|worldwide|work from home|wfh)\b/i.test(haystack)) return 'Remote';
  return 'OnSite';
}

function normaliseCompany(name) {
  const clean = toText(name).replace(/\s+/g, ' ').trim();
  for (const [re, canonical] of DOMAIN_ALIASES) if (re.test(clean)) return canonical;
  return clip(clean, 160);
}

/** Standing invitations to apply rather than an actual vacancy. A board that
 *  lists "Future Opportunities at X" looks like it has jobs it does not have. */
const NON_VACANCY =
  /\bfuture opportunit|\btalent (pool|pipeline|network)s?\b|\bgeneral application\b|\bopen application|expression of interest|\bspeculative application\b|\bevergreen (role|position|vacancy)\b|\bjoin our talent\b/i;

const droppedNonVacancies = [];

/**
 * Assemble a row that satisfies the table's constraints. A listing is dropped
 * rather than inserted malformed: no title, no employer or no link back to the
 * original posting means we cannot stand behind it.
 */
function buildJob({ source, externalId, title, company, location, url, description, requirements, categoryHint, modeHint, pay, verified, domain }) {
  const t = clip(toText(title), 160);
  if (NON_VACANCY.test(t)) {
    droppedNonVacancies.push(t);
    return null;
  }
  const c = normaliseCompany(company);
  let loc = clip(toText(location) || 'Not specified', 120);
  if (loc.length < 2) loc = 'Not specified';
  const link = String(url ?? '').trim();
  if (t.length < 3 || c.length < 2 || !/^https?:\/\//i.test(link)) return null;

  let desc = clip(toText(description), 5000);
  if (desc.length < 20) desc = `${t} at ${c}${loc !== 'Not specified' ? ` in ${loc}` : ''}. Full details on the original listing.`;
  if (desc.length < 20) return null;

  const req = clip(toText(requirements) || 'See the full listing for requirements.', 1000);

  return {
    source,
    external_id: String(externalId ?? slug(`${c}-${t}-${loc}`)),
    title: t,
    employer_name: c,
    location: loc,
    category: mapCategory(t, categoryHint),
    mode: mapMode(modeHint, loc, t),
    pay: clip(toText(pay) || 'Not disclosed', 120) || 'Not disclosed',
    description: desc,
    requirements: req.length >= 2 ? req : 'See the full listing for requirements.',
    source_url: link,
    company_domain: domain || domainFromUrl(link),
    employer_verified: Boolean(verified),
  };
}

// ------------------------------------------------------------------- adapters

async function fetchJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const ADAPTERS = {
  greenhouse: (it, company) =>
    buildJob({
      source: 'greenhouse',
      externalId: it.id,
      title: it.title,
      company: it.company_name || company.name,
      location: it.location?.name || joinList((it.offices ?? []).map((o) => o.name)),
      url: it.absolute_url,
      description: it.content,
      requirements: joinList((it.departments ?? []).map((d) => d.name)),
      categoryHint: joinList((it.departments ?? []).map((d) => d.name)),
      modeHint: it.location?.name,
      verified: true,
      domain: company.domain,
    }),
  lever: (it, company) =>
    buildJob({
      source: 'lever',
      externalId: it.id,
      title: it.text,
      company: company.name,
      location: first(it.categories?.location, it.country, it.workplaceType),
      url: first(it.hostedUrl, it.applyUrl),
      description: first(it.descriptionPlain, it.description, it.openingPlain, it.opening),
      requirements: first(it.additionalPlain, joinList(it.lists?.map((l) => l.text))),
      categoryHint: joinList([it.categories?.team, it.categories?.department, it.categories?.commitment]),
      modeHint: first(it.workplaceType, it.categories?.location),
      verified: true,
      domain: company.domain,
    }),
  ashby: (it, company) =>
    buildJob({
      source: 'ashby',
      externalId: it.id,
      title: it.title,
      company: company.name,
      location: first(it.location, joinList((it.secondaryLocations ?? []).map((s) => s.location)), it.address?.postalAddress?.addressLocality),
      url: first(it.jobUrl, it.applyUrl),
      description: first(it.descriptionPlain, it.descriptionHtml),
      requirements: first(it.team, it.department, it.employmentType),
      categoryHint: joinList([it.department, it.team, it.employmentType]),
      modeHint: first(it.isRemote ? 'Remote' : '', it.workplaceType, it.location),
      verified: true,
      domain: company.domain,
    }),
  workable: (it, company) =>
    buildJob({
      source: 'workable',
      externalId: first(it.shortcode, it.code, it.id),
      title: it.title,
      company: company.name,
      location: first(
        [it.city, it.state, it.country].filter(Boolean).join(', '),
        joinList((it.locations ?? []).map((l) => [l.city, l.country].filter(Boolean).join(', '))),
      ),
      url: first(it.url, it.application_url, it.shortlink),
      description: it.description,
      requirements: joinList([it.department, it.function, it.industry, it.experience]),
      categoryHint: joinList([it.department, it.function, it.industry]),
      modeHint: first(it.telecommuting ? 'Remote' : '', it.employment_type),
      pay: '',
      verified: true,
      domain: company.domain,
    }),
  smartrecruiters: (it, company) =>
    buildJob({
      source: 'smartrecruiters',
      externalId: it.id,
      title: it.name,
      company: first(it.company?.name, company.name),
      location: [it.location?.city, it.location?.region, it.location?.country].filter(Boolean).join(', '),
      url: first(it.ref, it.applyUrl),
      description: first(it.jobAd?.sections?.jobDescription?.text, it.jobAd?.sections?.companyDescription?.text),
      requirements: it.jobAd?.sections?.qualifications?.text,
      categoryHint: joinList([it.department?.label, it.function, it.industry?.label]),
      modeHint: first(it.location?.remote ? 'Remote' : '', it.typeOfEmployment?.label),
      verified: true,
      domain: company.domain,
    }),
  remotive: (it) =>
    buildJob({
      source: 'remotive',
      externalId: it.id,
      title: it.title,
      company: it.company_name,
      location: it.candidate_required_location,
      url: it.url,
      description: it.description,
      requirements: joinList(it.tags),
      categoryHint: joinList([it.category, it.tags, it.job_type]),
      modeHint: 'Remote',
      pay: it.salary,
      verified: false,
      domain: domainFromUrl(it.url),
    }),
  jobicy: (it) =>
    buildJob({
      source: 'jobicy',
      externalId: it.id,
      title: it.jobTitle,
      company: it.companyName,
      location: it.jobGeo,
      url: it.url,
      description: first(it.jobDescription, it.jobExcerpt),
      requirements: joinList(it.jobType),
      categoryHint: joinList([it.jobIndustry, it.jobLevel]),
      modeHint: 'Remote',
      verified: false,
      domain: domainFromUrl(it.url),
    }),
  himalayas: (it) =>
    buildJob({
      source: 'himalayas',
      externalId: it.guid,
      title: it.title,
      company: it.companyName,
      location: first(joinList(it.locationRestrictions), 'Remote'),
      url: it.applicationLink,
      description: first(it.description, it.excerpt),
      requirements: joinList([it.employmentType, it.seniority]),
      categoryHint: joinList([it.categories, it.parentCategories, it.seniority]),
      modeHint: 'Remote',
      pay:
        it.minSalary && it.maxSalary
          ? `${it.currency ?? ''} ${it.minSalary}–${it.maxSalary} per ${it.salaryPeriod ?? 'year'}`.trim()
          : '',
      verified: false,
      domain: domainFromUrl(it.applicationLink),
    }),
  arbeitnow: (it) =>
    buildJob({
      source: 'arbeitnow',
      externalId: it.slug,
      title: it.title,
      company: it.company_name,
      location: it.location,
      url: it.url,
      description: it.description,
      requirements: joinList(it.tags),
      categoryHint: joinList([it.tags, it.job_types, it.title]),
      modeHint: it.remote ? 'Remote' : '',
      verified: false,
      domain: domainFromUrl(it.url),
    }),
};

// ----------------------------------------------------------------------- main

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
/** Both `--out=dir` and `--out dir`. The workflow passes the value as a separate
 *  argument, which used to fall through to the default directory unnoticed. */
const flagValue = (name) => {
  const joined = args.find((a) => a.startsWith(`--${name}=`));
  if (joined) return joined.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = flagValue('only');
const outDir = flagValue('out') ?? process.env.RUNNER_TEMP ?? tmpdir();

async function loadCompanies() {
  const raw = JSON.parse(await readFile(path.join(HERE, 'approved-companies.json'), 'utf8'));
  return raw.companies ?? [];
}

async function collect() {
  const companies = await loadCompanies();
  const jobs = [];
  const report = [];
  const wanted = (source) => !only || only === source;

  const tasks = [
    ...companies
      .filter((c) => wanted(c.source) && ATS[c.source])
      .map((company) => async () => {
        const spec = ATS[company.source];
        try {
          const body = await fetchJson(spec.url(company.token));
          const items = spec.parse(body);
          const mapped = items
            .map((it) => ADAPTERS[company.source](it, company))
            .filter(Boolean);
          jobs.push(...mapped);
          report.push({ source: company.source, token: company.token, jobs: mapped.length, ok: true });
        } catch (err) {
          report.push({ source: company.source, token: company.token, jobs: 0, ok: false, error: String(err.message ?? err) });
        }
      }),
    ...FEEDS.filter((f) => wanted(f.source)).map((feed) => async () => {
      try {
        const body = await fetchJson(feed.url);
        // For open feeds, keep only roles a Uganda-based applicant can take.
        const mapped = (feed.parse(body) ?? [])
          .map((it) => ADAPTERS[feed.source](it))
          .filter((j) => j && AFRICA_OPEN.test(`${j.location} ${j.description.slice(0, 300)}`))
          .slice(0, FEED_CAP);
        jobs.push(...mapped);
        report.push({ source: feed.source, jobs: mapped.length, ok: true, attribution: feed.attribution });
      } catch (err) {
        report.push({ source: feed.source, jobs: 0, ok: false, error: String(err.message ?? err) });
      }
    }),
  ];

  await Promise.all(tasks.map((t) => t()));
  return { jobs, report };
}

/** Same vacancy twice (employer board + aggregator) should appear once. */
function dedupe(jobs) {
  const bySource = new Map();
  for (const job of jobs) bySource.set(`${job.source}::${job.external_id}`, job);

  const byIdentity = new Map();
  const dropped = [];
  for (const job of [...bySource.values()].sort((a, b) => Number(b.employer_verified) - Number(a.employer_verified))) {
    const key = `${job.employer_name}|${job.title}|${job.location}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (byIdentity.has(key)) {
      dropped.push(job);
      continue;
    }
    byIdentity.set(key, job);
  }
  return { jobs: [...byIdentity.values()], dropped };
}

function buildSql(jobs, generatedAt) {
  const tag = '$trootjobs$';
  const payload = JSON.stringify(jobs);
  if (payload.includes(tag)) throw new Error('dollar-quote tag collides with payload');
  return `-- Generated by scripts/ingest-jobs.mjs at ${generatedAt}
-- Applied over the database connection (SUPABASE_DB_URL); no anon key involved.
begin;
select public.ingest_external_jobs(${tag}${payload}${tag}::jsonb) as ingest;
select public.close_stale_external_jobs() as closed_stale;
select public.close_expired_jobs() as closed_expired;
commit;
`;
}

const { jobs: collected, report } = await collect();
const { jobs, dropped } = dedupe(collected);
const generatedAt = new Date().toISOString();

await mkdir(outDir, { recursive: true });
const previewPath = path.join(outDir, 'ingest-preview.json');
await writeFile(previewPath, JSON.stringify(jobs, null, 2));

console.log(`generated ${generatedAt}`);
for (const r of report.sort((a, b) => b.jobs - a.jobs)) {
  const status = r.ok ? `${r.jobs} listings` : `FAILED (${r.error})`;
  console.log(`  ${r.ok ? '+' : '!'} ${r.source.padEnd(15)} ${(r.token ?? '').padEnd(14)} ${status}`);
}
const verified = jobs.filter((j) => j.employer_verified).length;
console.log(`\ncollected ${collected.length} → ${jobs.length} after de-duplication (${collected.length - jobs.length} dropped)`);
if (droppedNonVacancies.length) console.log(`  standing/pipeline postings skipped: ${droppedNonVacancies.length}`);
console.log(`  from approved employers (verified): ${verified}`);
console.log(`  from public feeds:                 ${jobs.length - verified}`);
console.log(`  preview: ${previewPath}`);

if (dryRun) {
  console.log('\ndry run: no SQL written');
} else {
  const sqlPath = path.join(outDir, 'ingest.sql');
  await writeFile(sqlPath, buildSql(jobs, generatedAt));
  console.log(`  sql:     ${sqlPath}`);
}

const failures = report.filter((r) => !r.ok);
if (failures.length === report.length) {
  console.error('\nEvery source failed — refusing to continue.');
  process.exit(1);
}
