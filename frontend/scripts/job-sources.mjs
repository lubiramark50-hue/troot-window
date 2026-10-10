/**
 * The upstream feeds Troot Window syncs from.
 *
 * `ATS` entries are an employer's own applicant-tracking feed: the company
 * publishes them for distribution, the data is first-party, and listings from
 * them are shown as verified employers.
 *
 * `FEEDS` are third-party job boards with public APIs. Their listings are real
 * but not verified, they are capped per feed, and each requires the visible
 * attribution named here.
 */

export const FEED_CAP = 50;

export const FEEDS = [
  {
    source: 'remotive',
    label: 'Remotive',
    attribution: 'Jobs by Remotive',
    url: 'https://remotive.com/api/remote-jobs?limit=100',
    parse: (j) => j.jobs ?? [],
  },
  {
    source: 'jobicy',
    label: 'Jobicy',
    attribution: 'Jobs by Jobicy',
    url: 'https://jobicy.com/api/v2/remote-jobs?count=50',
    parse: (j) => j.jobs ?? [],
  },
  {
    source: 'himalayas',
    label: 'Himalayas',
    attribution: 'Jobs by Himalayas',
    url: 'https://himalayas.app/jobs/api?limit=50',
    parse: (j) => j.jobs ?? [],
  },
  {
    source: 'arbeitnow',
    label: 'Arbeitnow',
    attribution: 'Jobs by Arbeitnow',
    url: 'https://www.arbeitnow.com/api/job-board-api',
    // Arbeitnow is Germany-first; only its remote listings can be taken from Uganda.
    parse: (j) => (j.data ?? []).filter((x) => x.remote === true),
  },
];

export const ATS = {
  greenhouse: {
    label: 'Greenhouse',
    url: (t) => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`,
    parse: (j) => j.jobs ?? [],
  },
  lever: {
    label: 'Lever',
    url: (t) => `https://api.lever.co/v0/postings/${t}?mode=json`,
    parse: (j) => (Array.isArray(j) ? j : []),
  },
  ashby: {
    label: 'Ashby',
    url: (t) => `https://api.ashbyhq.com/posting-api/job-board/${t}`,
    // Only publicly listed roles: Ashby returns drafts too.
    parse: (j) => (j.jobs ?? []).filter((x) => x.isListed !== false),
  },
  workable: {
    label: 'Workable',
    url: (t) => `https://apply.workable.com/api/v1/widget/accounts/${t}?details=true`,
    parse: (j) => j.jobs ?? [],
  },
  smartrecruiters: {
    label: 'SmartRecruiters',
    url: (t) => `https://api.smartrecruiters.com/v1/companies/${t}/postings`,
    parse: (j) => j.content ?? [],
  },
};

/** Human-readable attribution for every source, used by the app's footer. */
export const ATTRIBUTIONS = Object.fromEntries(
  [...FEEDS.map((f) => [f.source, f.attribution]), ...Object.entries(ATS).map(([k, v]) => [k, `Listings from ${v.label}`])],
);
