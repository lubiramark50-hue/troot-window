import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, Bookmark, MapPin, Search, SearchX, WifiOff, X } from "lucide-react";
import { CATEGORIES, EXPERIENCE_LEVELS, MODES, PAY_CURRENCIES, PAY_PERIODS, jobsApi, modeLabel, sourceLabel, type Job } from "../api";
import { Avatar, LogoMark, splitReq, timeAgo, useSaved } from "../ui";

export function JobRow({ job }: { job: Job }) {
  const saved = useSaved();
  const on = saved.has(job.id);
  return (
    <article className="job-row">
      <Link to={`/jobs/${job.id}`} className="job-row-main">
        <Avatar job={job} />
        <div className="job-row-body">
          <h3>{job.title}</h3>
          <p className="sub">
            {job.employerName}
            {job.employerVerified && <BadgeCheck size={15} className="verified-ico" aria-label="Verified employer" />}
            {!job.employerVerified && job.source && <span className="via">via {sourceLabel(job.source)}</span>}
          </p>
          <p className="meta"><MapPin size={13} />{job.location}<span className="dot" />{modeLabel(job.mode)}</p>
          <div className="row-foot">
            <strong className="pay">{job.pay}</strong>
            <span className="ago">{timeAgo(job.publishedAt ?? job.createdAt)}</span>
          </div>
          {(job.experienceLevel || job.applicationDeadline) && <p className="job-structured-meta">{job.experienceLevel && <span>{job.experienceLevel}</span>}{job.applicationDeadline && <span>Apply by {job.applicationDeadline}</span>}</p>}
          <div className="chips-inline">{splitReq(job.requirements).slice(0, 3).map((x) => <span key={x}>{x}</span>)}</div>
        </div>
      </Link>
      <button className={`save-btn${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save job"} onClick={() => saved.toggle(job.id)}>
        <Bookmark size={20} fill={on ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

export const Skeletons = ({ n = 5 }: { n?: number }) => (
  <div aria-hidden="true">{Array.from({ length: n }, (_, i) => (
    <div className="job-row skeleton" key={i}><span className="sk sk-av" /><div className="sk-col"><span className="sk sk-l1" /><span className="sk sk-l2" /><span className="sk sk-l3" /></div></div>
  ))}</div>
);

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="state"><WifiOff size={34} /><h3>Couldn't load jobs</h3><p>{message}</p><button className="btn btn-primary" onClick={onRetry}>Try again</button></div>;
}

export default function Feed() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [term, setTerm] = useState(q);
  const category = params.get("c") ?? "All";
  const mode = params.get("m") ?? "All";
  const verified = params.get("v") === "1";
  const locationParam = params.get("l") ?? "";
  const [locationQuery, setLocationQuery] = useState(locationParam);
  const [locationTerm, setLocationTerm] = useState(locationParam);
  const [salaryMin, setSalaryMin] = useState(params.get("smin") ?? "");
  const [salaryMax, setSalaryMax] = useState(params.get("smax") ?? "");
  const [salaryCurrency, setSalaryCurrency] = useState(params.get("cur") ?? "UGX");
  const [payPeriod, setPayPeriod] = useState(params.get("period") ?? "");
  const [experienceLevel, setExperienceLevel] = useState(params.get("exp") ?? "");
  const [deadline, setDeadline] = useState(params.get("deadline") ?? "");
  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const value = q.trim();
      setTerm(value);
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value); else next.delete("q");
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, setParams]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const value = locationQuery.trim();
      setLocationTerm(value);
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("l", value); else next.delete("l");
        return next;
      }, { replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [locationQuery, setParams]);

  useEffect(() => {
    const urlQuery = params.get("q") ?? "";
    if (urlQuery !== term && urlQuery !== q) { setQ(urlQuery); setTerm(urlQuery); }
    const urlLocation = params.get("l") ?? "";
    if (urlLocation !== locationTerm && urlLocation !== locationQuery) { setLocationQuery(urlLocation); setLocationTerm(urlLocation); }
    setSalaryMin(params.get("smin") ?? ""); setSalaryMax(params.get("smax") ?? ""); setSalaryCurrency(params.get("cur") ?? "UGX");
    setPayPeriod(params.get("period") ?? ""); setExperienceLevel(params.get("exp") ?? ""); setDeadline(params.get("deadline") ?? "");
  }, [params]);

  useEffect(() => {
    let live = true;
    setBusy(true); setError(""); setPage(1);
    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setItems([]); setTotal(0); setHasNext(false); setBusy(false);
      return () => { live = false; };
    }
    jobsApi.list({ q: term, location: locationTerm, category, mode, verified, salaryMin: salaryMin ? Number(salaryMin) : undefined, salaryMax: salaryMax ? Number(salaryMax) : undefined, salaryCurrency: (salaryMin || salaryMax) ? salaryCurrency : undefined, payPeriod: payPeriod || undefined, experienceLevel: experienceLevel || undefined, deadline: deadline || undefined, page: 1, pageSize: 20 })
      .then((r) => { if (!live) return; setItems(r.items); setTotal(r.totalCount); setHasNext(r.hasNext); })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [term, locationTerm, category, mode, verified, salaryMin, salaryMax, salaryCurrency, payPeriod, experienceLevel, deadline, nonce]);

  const loadMore = useCallback(() => {
    if (more || busy || !hasNext) return;
    setMore(true);
    const next = page + 1;
    jobsApi.list({ q: term, location: locationTerm, category, mode, verified, salaryMin: salaryMin ? Number(salaryMin) : undefined, salaryMax: salaryMax ? Number(salaryMax) : undefined, salaryCurrency: (salaryMin || salaryMax) ? salaryCurrency : undefined, payPeriod: payPeriod || undefined, experienceLevel: experienceLevel || undefined, deadline: deadline || undefined, page: next, pageSize: 20 })
      .then((r) => { setItems((cur) => [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]); setPage(next); setHasNext(r.hasNext); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setMore(false));
  }, [more, busy, hasNext, page, term, locationTerm, category, mode, verified, salaryMin, salaryMax, salaryCurrency, payPeriod, experienceLevel, deadline]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && loadMore(), { rootMargin: "300px" });
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

  useEffect(() => {
    const next = new URLSearchParams(params);
    const values: Record<string, string> = { smin: salaryMin, smax: salaryMax, cur: (salaryMin || salaryMax) ? salaryCurrency : "", period: (salaryMin || salaryMax) ? payPeriod : "", exp: experienceLevel, deadline };
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next, { replace: true });
  }, [salaryMin, salaryMax, salaryCurrency, payPeriod, experienceLevel, deadline]);

  const activeFilterCount = Number(Boolean(term)) + Number(Boolean(locationTerm)) + Number(category !== "All") + Number(mode !== "All") + Number(verified) + Number(Boolean(salaryMin || salaryMax)) + Number(Boolean(payPeriod)) + Number(Boolean(experienceLevel)) + Number(Boolean(deadline));
  const clearFilters = () => {
    setQ(""); setTerm(""); setLocationQuery(""); setLocationTerm(""); setSalaryMin(""); setSalaryMax(""); setSalaryCurrency("UGX"); setPayPeriod(""); setExperienceLevel(""); setDeadline("");
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="screen">
      <header className="home-head">
        <div className="brandline"><LogoMark size={30} /><span>Troot Window</span></div>
        <h1 className="large-title">Find work near you</h1>
        <label className="search">
          <Search size={18} />
          <input type="search" inputMode="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job, skill, employer or town" aria-label="Search jobs" />
          {q && <button type="button" className="clear" onClick={() => setQ("")} aria-label="Clear search"><X size={16} /></button>}
        </label>
        <label className="search location-filter">
          <MapPin size={17} />
          <input type="search" value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Filter by town or district" aria-label="Filter jobs by town or district" />
          {locationQuery && <button type="button" className="clear" onClick={() => setLocationQuery("")} aria-label="Clear location filter"><X size={16} /></button>}
        </label>
        <div className="chips" role="group" aria-label="Category">
          {["All", ...CATEGORIES].map((c) => <button key={c} className={`chip${category === c ? " on" : ""}`} aria-pressed={category === c} onClick={() => setFilter("c", c)}>{c}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Work type">
          {[{ value: "All", label: "Any type" }, ...MODES].map((m) => <button key={m.value} className={`chip alt${mode === m.value ? " on" : ""}`} aria-pressed={mode === m.value} onClick={() => setFilter("m", m.value)}>{m.label}</button>)}
        </div>
        <details className="advanced-filters">
          <summary>More filters <span>Salary, experience and closing date</span></summary>
          <div className="advanced-filter-grid">
            <label className="filter-field">Minimum pay<input type="number" min="0" step="any" inputMode="decimal" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="No minimum" /></label>
            <label className="filter-field">Maximum pay<input type="number" min="0" step="any" inputMode="decimal" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="No maximum" /></label>
            <label className="filter-field">Currency<select disabled={!salaryMin && !salaryMax} value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)}>{PAY_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
            <label className="filter-field">Pay period<select value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)}><option value="">Any period</option>{PAY_PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}</select></label>
            <label className="filter-field">Experience level<select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}><option value="">Any experience</option>{EXPERIENCE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
            <label className="filter-field">Application deadline<select value={deadline} onChange={(e) => setDeadline(e.target.value)}><option value="">Any deadline</option><option value="7days">Closing within 7 days</option><option value="30days">Closing within 30 days</option><option value="none">No deadline specified</option></select></label>
          </div>
          {salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax) && <p className="filter-error" role="alert">Minimum pay cannot exceed maximum pay.</p>}
          {(salaryMin || salaryMax) && <p className="filter-hint">Salary filters only match structured ranges in the selected currency. Entering both values on a posted job is required; free-text pay is never guessed.</p>}
        </details>
        {/* Kept out of the scrollable rows above: it is the filter that decides
            whether a listing is a verified employer, so it must be reachable
            without swiping. */}
        <div className="chips" role="group" aria-label="Verification">
          <button className={`chip ok${verified ? " on" : ""}`} aria-pressed={verified} onClick={toggleVerified}>
            <BadgeCheck size={15} />Verified employers only
          </button>
        </div>
        {activeFilterCount > 0 && <div className="filter-summary">
          <span>{activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} active{locationTerm ? ` · ${locationTerm}` : ""}</span>
          <button type="button" onClick={clearFilters}>Clear filters</button>
        </div>}
      </header>

      {busy ? <Skeletons /> : error && items.length === 0 ? <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} /> : items.length === 0 ? (
        <div className="state"><SearchX size={34} /><h3>No jobs match</h3><p>Try a different skill, town or category.</p>{activeFilterCount > 0 && <button type="button" className="btn btn-soft" onClick={clearFilters}>Clear filters</button>}</div>
      ) : (
        <>
          <p className="count" role="status" aria-live="polite">{total} {total === 1 ? "job" : "jobs"} found</p>
          <div className="list">{items.map((j) => <JobRow key={j.id} job={j} />)}</div>
          <div ref={sentinel} className="sentinel">{more && <Skeletons n={1} />}{error && <button className="btn btn-ghost" onClick={loadMore}>Retry loading more</button>}</div>
          <p className="source-note feed-note">
            Verified listings come from the employer's own careers page. Other listings are provided by
            <a href="https://remotive.com" target="_blank" rel="noopener noreferrer">Remotive</a>,
            <a href="https://jobicy.com" target="_blank" rel="noopener noreferrer">Jobicy</a>,
            <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Himalayas</a> and
            <a href="https://www.arbeitnow.com" target="_blank" rel="noopener noreferrer">Arbeitnow</a>.
            Always confirm details on the original posting.
          </p>
        </>
      )}
    </div>
  );
}
