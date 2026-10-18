import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, BadgeCheck, BriefcaseBusiness, ChevronRight, Mail, MessageCircle, Search, Send, ShieldCheck, Smartphone, UserRound, WifiOff } from "lucide-react";
import { jobsApi, type Job } from "../api";
import { Avatar, timeAgo, useToast } from "../ui";

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const requestedId = params.get("job") || "";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeId, setActiveId] = useState(requestedId);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [detailBusy, setDetailBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    jobsApi.list({ page: 1, pageSize: 50 }).then((result) => {
      if (!live) return;
      setJobs(result.items);
      setError("");
      if (requestedId) setActiveId(requestedId);
      else if (result.items.length) setActiveId((current) => current || result.items[0].id);
    }).catch((e: Error) => live && setError(e.message)).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (requestedId && requestedId !== activeId) setActiveId(requestedId);
  }, [requestedId]);

  useEffect(() => {
    if (!activeId) { setActiveJob(null); return; }
    let live = true;
    setDetailBusy(true);
    jobsApi.get(activeId).then((job) => live && setActiveJob(job))
      .catch(() => live && setActiveJob(jobs.find((job) => job.id === activeId) || null))
      .finally(() => live && setDetailBusy(false));
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("job", activeId);
      return next;
    }, { replace: true });
    return () => { live = false; };
  }, [activeId, jobs, setParams]);

  const filtered = useMemo(() => jobs.filter((job) => (job.title + " " + job.employerName + " " + job.location).toLowerCase().includes(query.toLowerCase())), [jobs, query]);

  const sendMessage = () => {
    if (!activeJob || !draft.trim()) return;
    const message = encodeURIComponent(draft.trim());
    const phone = (activeJob.whatsApp || activeJob.phone || "").replace(/[^0-9]/g, "");
    if (phone) {
      window.open("https://wa.me/" + phone + "?text=" + message, "_blank", "noopener,noreferrer");
      toast("Message draft opened in WhatsApp. Send it there to deliver.");
      return;
    }
    if (activeJob.email) {
      window.location.href = "mailto:" + activeJob.email + "?subject=" + encodeURIComponent("Regarding: " + activeJob.title) + "&body=" + message;
      toast("Email draft opened in your mail app.");
      return;
    }
    toast("This listing has no direct contact details yet.");
  };

  const canContact = !!((activeJob?.whatsApp || activeJob?.phone || "").replace(/[^0-9]/g, "") || activeJob?.email);

  return <div className="screen messages-screen">
    <header className="messages-heading">
      <div>
        <div className="page-kicker"><MessageCircle size={15} /> DIRECT CONTACT</div>
        <h1 className="large-title">Messages</h1>
        <p className="messages-subtitle">Reach employers about the jobs that matter to you.</p>
      </div>
      <div className="messages-heading-icon"><MessageCircle size={25} /></div>
    </header>
    <div className="message-workspace">
      <section className="conversation-list" aria-label="Jobs to contact">
        <div className="conversation-list-head"><h2>Jobs to contact</h2><span>{jobs.length}</span></div>
        <label className="search message-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a job or employer" aria-label="Find a job or employer" /></label>
        {busy && <div className="message-empty"><span className="sk sk-l1" /><span className="sk sk-l2" /><span className="sk sk-l3" /></div>}
        {error && !busy && <div className="message-empty" role="alert"><WifiOff size={24} /><p>{error}</p><button type="button" className="btn btn-soft" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}
        {!busy && !error && filtered.length === 0 && <div className="message-empty"><BriefcaseBusiness size={25} /><p>No matching jobs. Try another search or browse the job feed.</p><Link className="btn btn-soft" to="/">Browse jobs</Link></div>}
        {!busy && !error && filtered.map((job) => <button type="button" key={job.id} className={"conversation-item" + (activeId === job.id ? " selected" : "")} onClick={() => { setActiveId(job.id); setDraft(""); }}>
          <Avatar job={job} size={43} />
          <span className="conversation-copy"><b>{job.employerName}</b><span>{job.title}</span><small>{job.location} · {timeAgo(job.publishedAt || job.createdAt)}</small></span>
          <ChevronRight size={16} className="conversation-chevron" />
        </button>)}
        <p className="contact-list-note"><ShieldCheck size={14} /> Only contact details published with each listing are used.</p>
      </section>
      <section className="message-panel" aria-label="Message employer">
        {activeJob ? <>
          <header className="message-panel-head">
            <Avatar job={activeJob} size={46} />
            <div className="message-recipient"><h2>{activeJob.employerName} {activeJob.employerVerified && <BadgeCheck size={16} className="verified-ico" />}</h2><p><BriefcaseBusiness size={14} /> {activeJob.title}</p><span>{activeJob.location}</span></div>
            <span className="contact-status"><ShieldCheck size={12} /> Listing contact</span>
          </header>
          <div className="message-history">
            <div className="message-day">ABOUT THIS JOB</div>
            <div className="job-context-card"><div className="job-context-icon"><BriefcaseBusiness size={19} /></div><div><b>{activeJob.title}</b><p>{activeJob.employerName} · {activeJob.location}</p><span>{activeJob.pay}</span></div></div>
            <div className="message-welcome"><div className="welcome-mark"><MessageCircle size={20} /></div><h3>Start a conversation</h3><p>Ask about the role, requirements, application process or interview details. Be polite and never send money to get a job.</p></div>
            {activeJob.description && <div className="message-hint"><span>Quick context</span><p>{activeJob.description.slice(0, 210)}{activeJob.description.length > 210 ? "…" : ""}</p></div>}
          </div>
          <div className="message-composer-wrap">
            <div className="composer-safety"><ShieldCheck size={14} /> Your message opens in the employer's available contact app.</div>
            <label className="message-composer"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={1500} placeholder={"Hi " + activeJob.employerName + ", I'm interested in the " + activeJob.title + " role…"} aria-label="Write a message to the employer" />
              <div className="composer-footer"><span>{draft.length}/1500</span><button type="button" className="btn btn-primary send-message" disabled={!draft.trim() || detailBusy || !canContact} onClick={sendMessage}><Send size={16} /> Send message <ArrowUpRight size={15} /></button></div>
            </label>
            {!canContact && <p className="no-contact-note"><UserRound size={14} /> This listing does not include a phone, WhatsApp or email contact.</p>}
            {canContact && <p className="delivery-note">{activeJob.whatsApp || activeJob.phone ? <><MessageCircle size={13} /> WhatsApp {activeJob.whatsApp ? "available" : "via phone number"}</> : <><Mail size={13} /> Email available</>}</p>}
          </div>
        </> : <div className="message-placeholder"><div className="placeholder-art"><MessageCircle size={32} /></div><h2>Your next conversation starts here</h2><p>Choose a job on the left to prepare a message for its employer.</p></div>}
      </section>
    </div>
    <div className="messages-footnote"><Smartphone size={14} /> Your draft opens in WhatsApp or email. Review it and press Send in that app; Troot Window does not store or deliver in-app messages.</div>
  </div>;
}
