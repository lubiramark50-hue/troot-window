import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BadgeCheck, Bookmark, BriefcaseBusiness, ChevronRight, MapPin, Search, SearchX, ShieldCheck, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { CATEGORIES, MODES, jobsApi, modeLabel, sourceLabel, type Job } from "../api";
import { Avatar, LogoMark, splitReq, timeAgo, useSaved } from "../ui";

export function JobRow({ job }: { job: Job }) {
  const saved = useSaved();
  const on = saved.has(job.id);
  return <article className="job-row">
    <Link to={`/jobs/${job.id}`} className="job-row-main">
      <Avatar job={job} />
      <div className="job-row-body">
        <h3>{job.title}</h3>
        <p className="sub">{job.employerName}
          {job.employerVerified && <BadgeCheck size={15} className="verified-ico" aria-label="Verified employer" />}
          {!job.employerVerified && job.source && <span className="via">via {sourceLabel(job.source)}</span>}
        </p>
        <p className="meta"><MapPin size={14} />{job.location}<span className="dot" />{modeLabel(job.mode)}</p>
        <div className="row-foot"><strong className="pay">{job.pay}</strong><span className="ago">{timeAgo(job.publishedAt ?? job.createdAt)}</span></div>
        <div className="chips-inline">{splitReq(job.requirements).slice(0, 3).map(x => <span key={x}>{x}</span>)}</div>
      </div>
    </Link>
    <button className={`save-btn${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save job"} onClick={() => saved.toggle(job.id)}>
      <Bookmark size={19} fill={on ? "currentColor" : "none"} />
    </button>
  </article>;
}

export const Skeletons = ({ n = 5 }: { n?: number }) => <div aria-hidden="true" className="tw-skeleton-list">
  {Array.from({ length: n }, (_, i) => <div className="job-row skeleton" key={i}><span className="sk sk-av" /><div className="sk-col"><span className="sk sk-l1" /><span className="sk sk-l2" /><span className="sk sk-l3" /></div></div>)}
</div>;

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="state"><WifiOff size={34} /><h3>Couldn't load jobs</h3><p>{message}</p><button className="btn btn-primary" onClick={onRetry}>Try again</button></div>;
}

export default function Feed() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const term = q.trim();
  const urlQuery = params.get("q") ?? "";
  const category = params.get("c") ?? "All";
  const mode = params.get("m") ?? "All";
  const verified = params.get("v") === "1";
  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);

  useEffect(() => { setQ(urlQuery); }, [urlQuery]);
  const updateQuery = (value: string) => {
    setQ(value);
    const next = new URLSearchParams(params);
    if (value) next.set("q", value); else next.delete("q");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    let live = true;
    requestVersion.current += 1;
    setBusy(true); setMore(false); setItems([]); setError(""); setPage(1);
    const timer = window.setTimeout(() => jobsApi.list({ q: term, category, mode, verified, page: 1, pageSize: 20 })
      .then(r => { if (!live) return; setItems(r.items); setTotal(r.totalCount); setHasNext(r.hasNext); })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false)), 300);
    return () => { live = false; window.clearTimeout(timer); };
  }, [term, category, mode, verified, nonce]);
  const loadMore = useCallback(() => {
    if (more || busy || !hasNext) return;
    setMore(true);
    const version = requestVersion.current;
    const next = page + 1;
    jobsApi.list({ q: term, category, mode, verified, page: next, pageSize: 20 })
      .then(r => {
        if (version !== requestVersion.current) return;
        setItems(cur => [...cur, ...r.items.filter(x => !cur.some(c => c.id === x.id))]);
        setPage(next); setHasNext(r.hasNext);
      })
      .catch((e: Error) => { if (version === requestVersion.current) setError(e.message); })
      .finally(() => { if (version === requestVersion.current) setMore(false); });
  }, [more, busy, hasNext, page, term, category, mode, verified]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(e => e[0]?.isIntersecting && loadMore(), { rootMargin: "350px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const setFilter = (key: "c" | "m", value: string) => {
    const next = new URLSearchParams(params);
    if (value === "All") next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };
  const toggleVerified = () => {
    const next = new URLSearchParams(params);
    if (verified) next.delete("v"); else next.set("v", "1");
    setParams(next, { replace: true });
  };
  const goToJobs = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const activeFilters = (category !== "All" ? 1 : 0) + (mode !== "All" ? 1 : 0) + (verified ? 1 : 0);

  return <div className="screen tw-home">
    <div className="tw-mobile-brand"><div className="tw-mobile-brandline"><LogoMark size={34} /><span className="tw-wordmark">Troot <b>Window</b></span></div><Link to="/safety" className="tw-mobile-safe" aria-label="Safety tips"><ShieldCheck size={20} /></Link></div>
    <div className="tw-desktop-toolbar"><div className="tw-toolbar-breadcrumb"><span>Discover</span><ChevronRight size={14}/><b>Jobs</b></div><Link to="/post" className="tw-toolbar-post"><BriefcaseBusiness size={16}/> For employers <ArrowUpRight size={15}/></Link></div>

    <section className="tw-hero" aria-labelledby="tw-hero-title">
      <div className="tw-hero-copy">
        <h1 id="tw-hero-title">Find your next <span>job.</span></h1>
        <p>Browse listings, save jobs, and contact employers. No account needed to browse.</p>
      </div>
    </section>

    <div className="tw-search-area">
      <div className="tw-section-intro">
        <div><h2>Search jobs</h2></div>
        <Link to="/post" className="tw-post-link">Hiring? Post a job <ArrowRight size={16}/></Link>
      </div>
      <div className="tw-search-row">
        <label className="search tw-search"><Search size={20}/><input type="search" inputMode="search" enterKeyHint="search" value={q} onChange={e => updateQuery(e.target.value)} placeholder="Job title, skill, employer or city" aria-label="Search jobs" />
          {q && <button type="button" className="clear" onClick={() => updateQuery("")} aria-label="Clear search"><X size={16}/></button>}</label>
        <button type="button" className={`tw-filter-toggle${activeFilters ? " active" : ""}`} onClick={() => setShowFilters(s => !s)} aria-label={`Filters${activeFilters ? ` (${activeFilters})` : ""}`} aria-expanded={showFilters} aria-controls="tw-filter-groups"><SlidersHorizontal size={18}/><span>Filters{activeFilters ? ` (${activeFilters})` : ""}</span></button>
        <button className="tw-desktop-search-cta" onClick={goToJobs}>Search jobs <ArrowRight size={16}/></button>
      </div>
      <div id="tw-filter-groups" className={`tw-filter-groups${showFilters ? " expanded" : ""}`}>
        <div className="chips" role="group" aria-label="Work type">{[{ value: "All", label: "Any type" }, ...MODES].map(m =>
          <button key={m.value} className={`chip alt${mode === m.value ? " on" : ""}`} aria-pressed={mode === m.value} onClick={() => setFilter("m", m.value)}>{m.label}</button>)}
          <button className={`chip ok${verified ? " on" : ""}`} aria-pressed={verified} onClick={toggleVerified}><BadgeCheck size={15}/>Verified only</button>
        </div>
      </div>
    </div>

    <section className="tw-categories" aria-labelledby="category-heading">
      <div className="tw-section-heading"><div><h2 id="category-heading">Categories</h2></div><button onClick={() => setFilter("c", "All")} className="tw-text-button">All categories <ArrowRight size={15}/></button></div>
      <div className="tw-category-grid">{CATEGORIES.map(c => <button type="button" key={c} className={`tw-category-card${category === c ? " on" : ""}`} aria-pressed={category === c} onClick={() => setFilter("c", category === c ? "All" : c)}>
        <strong>{c}</strong>
      </button>)}</div>
    </section>

    <div className="tw-content-grid" ref={resultsRef}>
      <section className="tw-results" aria-labelledby="results-heading" aria-busy={busy}>
        <div className="tw-section-heading tw-results-heading"><div><h2 id="results-heading">{category === "All" ? "Latest jobs" : `${category} jobs`}</h2></div>
          {!busy && !error && <span className="tw-result-count">{total.toLocaleString()} {total === 1 ? "job" : "jobs"}</span>}
        </div>
        {busy ? <><span className="sr-only" role="status">Loading jobs…</span><Skeletons/></> : error && items.length === 0 ? <ErrorState message={error} onRetry={() => setNonce(n => n+1)}/> : items.length === 0 ? <div className="state tw-empty"><SearchX size={38}/><h3>No matching jobs</h3><p>Try another category, search term, or work type.</p><button className="btn btn-primary" onClick={() => { setQ(""); setParams(new URLSearchParams()); }}>Clear filters</button></div> : <>
          <div className="list">{items.map(j => <JobRow key={j.id} job={j}/>)}</div>
          <div ref={sentinel} className="sentinel">{more && <Skeletons n={2}/ >}{error && <button className="btn btn-ghost" onClick={loadMore}>Retry loading more</button>}</div>
        </>}
        <p className="source-note tw-source-note">Listings may come directly from employers or attributed public job feeds. Always check the original posting and never pay to apply. Company logos identify employers and do not imply endorsement. <a href="/employer-logos/CREDITS.html" target="_blank" rel="noopener noreferrer">Logo credits</a>.</p>
      </section>
      <aside className="tw-discover-aside" aria-label="Job search guidance">
        <div className="tw-trust-card"><ShieldCheck size={22}/><h3>Never pay to apply</h3><p>Check who posted a job before sharing personal details. A verified badge identifies an approved employer source; it is not a guarantee.</p><Link to="/safety">Read safety tips <ArrowRight size={16}/></Link></div>
        <div className="tw-employer-card"><h3>Hiring?</h3><p>Add the role, pay, location, and a way for applicants to reach you.</p><Link to="/post">Post a job <ArrowRight size={16}/></Link></div>
      </aside>
    </div>
  </div>;
}
