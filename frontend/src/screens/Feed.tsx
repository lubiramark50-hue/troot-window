import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, Bookmark, MapPin, Search, SearchX, WifiOff, X } from "lucide-react";
import { CATEGORIES, MODES, jobsApi, modeLabel, sourceLabel, type Job } from "../api";
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
  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = window.setTimeout(() => setTerm(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);

  useEffect(() => {
    let live = true;
    setBusy(true); setError(""); setPage(1);
    jobsApi.list({ q: term, category, mode, verified, page: 1, pageSize: 20 })
      .then((r) => { if (!live) return; setItems(r.items); setTotal(r.totalCount); setHasNext(r.hasNext); })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [term, category, mode, verified, nonce]);

  const loadMore = useCallback(() => {
    if (more || busy || !hasNext) return;
    setMore(true);
    const next = page + 1;
    jobsApi.list({ q: term, category, mode, verified, page: next, pageSize: 20 })
      .then((r) => { setItems((cur) => [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]); setPage(next); setHasNext(r.hasNext); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setMore(false));
  }, [more, busy, hasNext, page, term, category, mode, verified]);

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
        <div className="chips" role="group" aria-label="Category">
          {["All", ...CATEGORIES].map((c) => <button key={c} className={`chip${category === c ? " on" : ""}`} aria-pressed={category === c} onClick={() => setFilter("c", c)}>{c}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Work type">
          {[{ value: "All", label: "Any type" }, ...MODES].map((m) => <button key={m.value} className={`chip alt${mode === m.value ? " on" : ""}`} aria-pressed={mode === m.value} onClick={() => setFilter("m", m.value)}>{m.label}</button>)}
        </div>
        {/* Kept out of the scrollable rows above: it is the filter that decides
            whether a listing is a verified employer, so it must be reachable
            without swiping. */}
        <div className="chips" role="group" aria-label="Verification">
          <button className={`chip ok${verified ? " on" : ""}`} aria-pressed={verified} onClick={toggleVerified}>
            <BadgeCheck size={15} />Verified employers only
          </button>
        </div>
      </header>

      {busy ? <Skeletons /> : error && items.length === 0 ? <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} /> : items.length === 0 ? (
        <div className="state"><SearchX size={34} /><h3>No jobs match</h3><p>Try a different skill, town or category.</p></div>
      ) : (
        <>
          <p className="count">{total} {total === 1 ? "job" : "jobs"}</p>
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
