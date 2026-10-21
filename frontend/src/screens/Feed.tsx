import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BadgeCheck, Bookmark, BriefcaseBusiness, CheckCircle2, ChevronRight, Clock3, MapPin, Search, SearchX, ShieldCheck, SlidersHorizontal, Sparkles, WifiOff, X } from "lucide-react";
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

const CATEGORY_ICONS: Record<string, string> = {
  Construction: "🏗️", Technology: "💻", Trades: "🛠️", Hospitality: "🏨", Transport: "🚚", Other: "✨",
};

export default function Feed() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [term, setTerm] = useState(q);
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

  useEffect(() => { const t = window.setTimeout(() => setTerm(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);
  useEffect(() => {
    let live = true;
    setBusy(true); setError(""); setPage(1);
    jobsApi.list({ q: term, category, mode, verified, page: 1, pageSize: 20 })
      .then(r => { if (!live) return; setItems(r.items); setTotal(r.totalCount); setHasNext(r.hasNext); })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [term, category, mode, verified, nonce]);
  const loadMore = useCallback(() => {
    if (more || busy || !hasNext) return;
    setMore(true);
    const next = page + 1;
    jobsApi.list({ q: term, category, mode, verified, page: next, pageSize: 20 })
      .then(r => {
        setItems(cur => [...cur, ...r.items.filter(x => !cur.some(c => c.id === x.id))]);
        setPage(next); setHasNext(r.hasNext);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setMore(false));
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
    <div className="tw-desktop-toolbar"><div className="tw-toolbar-breadcrumb"><span>Discover</span><ChevronRight size={14}/><b>Find your next opportunity</b></div><Link to="/post" className="tw-toolbar-post"><BriefcaseBusiness size={16}/> For employers <ArrowUpRight size={15}/></Link></div>

    <section className="tw-hero" aria-labelledby="tw-hero-title">
      <div className="tw-hero-copy">
        <div className="tw-eyebrow"><Sparkles size={14}/> THE FUTURE LOOKS BRIGHT</div>
        <h1 id="tw-hero-title">Find a job that <span>moves your life forward.</span></h1>
        <p>Real opportunities, genuine connections. Discover your next big step with Troot Window.</p>
        <button type="button" className="tw-hero-cta" onClick={goToJobs}>Explore opportunities <ArrowRight size={18}/></button>
        <div className="tw-hero-trust"><span><CheckCircle2 size={16}/> Free to explore</span><span><ShieldCheck size={16}/> Safety first</span></div>
      </div>
      <div className="tw-hero-visual" aria-hidden="true"><div className="tw-hero-orbit"/><div className="tw-hero-photo"/><div className="tw-hero-visual-label">Work.<br/>Grow.<br/>Belong.<span/></div></div>
    </section>

    <div className="tw-search-area">
      <div className="tw-section-intro">
        <div><span className="tw-kicker">YOUR NEXT OPPORTUNITY</span><h2>Explore jobs made for you</h2></div>
        <Link to="/post" className="tw-post-link">Hiring? Post a job <ArrowRight size={16}/></Link>
      </div>
      <div className="tw-search-row">
        <label className="search tw-search"><Search size={20}/><input type="search" inputMode="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Job title, skill, employer or city" aria-label="Search jobs" />
          {q && <button type="button" className="clear" onClick={() => setQ("")} aria-label="Clear search"><X size={16}/></button>}</label>
        <button type="button" className={`tw-filter-toggle${activeFilters ? " active" : ""}`} onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters} aria-controls="tw-filter-groups"><SlidersHorizontal size={18}/><span>Filters{activeFilters ? ` (${activeFilters})` : ""}</span></button>
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
      <div className="tw-section-heading"><div><span className="tw-kicker">BROWSE YOUR WAY</span><h2 id="category-heading">Popular categories</h2></div><button onClick={() => setFilter("c", "All")} className="tw-text-button">View all <ArrowRight size={15}/></button></div>
      <div className="tw-category-grid">{CATEGORIES.map(c => <button type="button" key={c} className={`tw-category-card${category === c ? " on" : ""}`} aria-pressed={category === c} onClick={() => setFilter("c", category === c ? "All" : c)}>
        <span className="tw-category-emoji" aria-hidden="true">{CATEGORY_ICONS[c]}</span><strong>{c}</strong><span>Explore jobs <ArrowRight size={12}/></span>
      </button>)}</div>
    </section>

    <div className="tw-content-grid" ref={resultsRef}>
      <section className="tw-results" aria-labelledby="results-heading">
        <div className="tw-section-heading tw-results-heading"><div><span className="tw-kicker">OPPORTUNITIES FOR YOU</span><h2 id="results-heading">{category === "All" ? "Latest job opportunities" : `${category} jobs`}</h2></div>
          {!busy && !error && <span className="tw-result-count">{total.toLocaleString()} {total === 1 ? "job" : "jobs"}</span>}
        </div>
        {busy ? <Skeletons/> : error && items.length === 0 ? <ErrorState message={error} onRetry={() => setNonce(n => n+1)}/> : items.length === 0 ? <div className="state tw-empty"><SearchX size={38}/><h3>No matching opportunities yet</h3><p>Try another category, search term, or work type.</p><button className="btn btn-primary" onClick={() => { setQ(""); setParams(new URLSearchParams()); }}>Clear filters</button></div> : <>
          <div className="list">{items.map(j => <JobRow key={j.id} job={j}/>)}</div>
          <div ref={sentinel} className="sentinel">{more && <Skeletons n={2}/ >}{error && <button className="btn btn-ghost" onClick={loadMore}>Retry loading more</button>}</div>
        </>}
        <p className="source-note tw-source-note">Listings may come directly from employers or attributed public job feeds. Always check the original posting and never pay to apply.</p>
      </section>
      <aside className="tw-discover-aside">
        <div className="tw-trust-card"><div className="tw-trust-icon"><ShieldCheck size={28}/></div><span className="tw-kicker">YOUR SAFETY MATTERS</span><h3>Find work with more confidence.</h3><p>Know where listings come from, recognize verified employers, and report anything suspicious.</p>
          <div className="tw-trust-list"><span><CheckCircle2 size={17}/> Clear employer information</span><span><CheckCircle2 size={17}/> Visible verification status</span><span><CheckCircle2 size={17}/> One-tap job reporting</span></div>
          <Link to="/safety">Explore safety tips <ArrowRight size={16}/></Link>
        </div>
        <div className="tw-employer-card"><div className="tw-employer-icon"><BriefcaseBusiness size={21}/></div><h3>Looking for great people?</h3><p>Post your opening and connect directly with job seekers.</p><Link to="/post">Post a job <ArrowRight size={16}/></Link></div>
        <div className="tw-small-note"><Clock3 size={17}/><span>New opportunities are added regularly. Save the ones you like so you can return later.</span></div>
      </aside>
    </div>
  </div>;
}
