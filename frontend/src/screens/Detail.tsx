import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, Bookmark, CheckCircle2, ExternalLink, Flag, Mail, MapPin, MessageCircle, Phone, Share2, ShieldAlert, Wallet, Briefcase, Laptop } from "lucide-react";
import { jobsApi, modeLabel, sourceLabel, type Job } from "../api";
import { JobContent, isFormattedJobText } from "../JobContent";
import { Avatar, splitReq, timeAgo, TopBar, useSaved, useToast } from "../ui";

export default function Detail() {
  const { id = "" } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const saved = useSaved();
  const toast = useToast();

  useEffect(() => {
    let live = true;
    setJob(null); setError("");
    jobsApi.get(id).then((j) => live && setJob(j)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [id]);

  if (error) return <div className="screen full"><TopBar title="Job" /><div className="state"><ShieldAlert size={34} /><h3>Job unavailable</h3><p>{error}</p></div></div>;
  if (!job) return <div className="screen full"><TopBar title="Job" /><div className="detail-skel" aria-hidden="true"><span className="sk sk-av big" /><span className="sk sk-l1" /><span className="sk sk-l2" /><span className="sk sk-block" /></div></div>;

  const on = saved.has(job.id);
  const digits = job.whatsApp?.replace(/\D/g, "");
  const msg = encodeURIComponent(`Hello, I found your "${job.title}" job on Troot Window and would like to apply. Please share the next steps.`);

  const share = async () => {
    const url = `${location.origin}/jobs/${job.id}`;
    try {
      if (navigator.share) await navigator.share({ title: job.title, text: `${job.title} at ${job.employerName}`, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch { /* user dismissed the share sheet */ }
  };

  const report = async () => {
    if (reporting || reported) return;
    setReporting(true);
    try { await jobsApi.report(job.id, { reason: "Suspicious or unsafe job listing" }); setReported(true); toast("Report sent. Thank you."); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not send report."); }
    finally { setReporting(false); }
  };

  return (
    <div className="screen full">
      <TopBar title="Job details" right={<>
        <button className="icon-btn" onClick={share} aria-label="Share"><Share2 size={20} /></button>
        <button className={`icon-btn${on ? " on" : ""}`} onClick={() => saved.toggle(job.id)} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save job"}><Bookmark size={20} fill={on ? "currentColor" : "none"} /></button>
      </>} />
      <div className="detail">
        <div className="detail-head">
          <Avatar job={job} size={58} />
          <div>
            <h2>{job.title}</h2>
            <p className="sub">{job.employerName}{job.employerVerified && <span className="badge-ok"><BadgeCheck size={14} />Verified</span>}</p>
            <p className="ago">Posted {timeAgo(job.publishedAt ?? job.createdAt)}</p>
            {job.sourceUrl && <p className="via-line">Listed on {sourceLabel(job.source)}</p>}
          </div>
        </div>

        <div className="facts">
          <div><Wallet size={18} /><span>Pay</span><b>{job.pay}</b></div>
          <div><MapPin size={18} /><span>Location</span><b>{job.location}</b></div>
          <div><Laptop size={18} /><span>Work type</span><b>{modeLabel(job.mode)}</b></div>
          <div><Briefcase size={18} /><span>Category</span><b>{job.category}</b></div>
        </div>

        <section><h3>About the job</h3><JobContent text={job.description} /></section>
        <section><h3>Requirements</h3>{isFormattedJobText(job.requirements) ? <JobContent text={job.requirements} /> : <ul className="req">{splitReq(job.requirements).map((r) => <li key={r}><CheckCircle2 size={17} />{r}</li>)}</ul>}</section>

        {job.sourceUrl && (
          <p className="source-note">
            This vacancy was published by {job.employerName} and collected from {sourceLabel(job.source)}.
            Apply on the original posting, and check the details there before sharing anything.
          </p>
        )}

        <aside className="notice"><ShieldAlert size={20} /><p><b>Stay safe.</b> Never pay to get a job. Do not share passwords, OTPs or bank details.</p></aside>

        <button className="report-btn" onClick={report} disabled={reporting || reported}><Flag size={15} />{reported ? "Report received" : reporting ? "Sending report" : "Report this job"}</button>
      </div>

      <div className="actionbar">
        <div className="actionbar-inner">
        {job.sourceUrl && (
          <a className="btn btn-primary grow" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={19} />View original listing
          </a>
        )}
        {digits && <a className={`btn grow ${job.sourceUrl ? "btn-soft" : "btn-green"}`} href={`https://wa.me/${digits}?text=${msg}`} rel="noopener noreferrer"><MessageCircle size={19} />WhatsApp</a>}
        {job.phone && <a className={`btn grow ${digits ? "btn-soft" : "btn-primary"}`} href={`tel:${job.phone.replace(/[^\d+]/g, "")}`}><Phone size={19} />Call</a>}
        {job.email && <a className={`btn ${digits || job.phone ? "btn-soft icon-only" : "btn-primary grow"}`} aria-label="Email employer" href={`mailto:${job.email}?subject=${encodeURIComponent("Application: " + job.title)}&body=${msg}`}><Mail size={19} />{!(digits || job.phone) && "Email"}</a>}
        </div>
      </div>
    </div>
  );
}
