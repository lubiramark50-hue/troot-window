import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { CheckCircle2, LogOut, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "../supabase";
import { TopBar, timeAgo } from "../ui";

type PendingJob = {
  id: string; title: string; employer_name: string; location: string; category: string;
  mode: string; pay: string; description: string; requirements: string; phone: string | null;
  whatsapp: string | null; email: string | null; created_at: string; salary_min: number | null;
  salary_max: number | null; salary_currency: string; pay_period: string | null;
  experience_level: string | null; application_deadline: string | null;
};

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingId, setWorkingId] = useState("");
  const isAdmin = user?.app_metadata?.role === "admin";

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!live) return;
      if (sessionError) setError(sessionError.message);
      setUser(data.session?.user ?? null);
    }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);

  const loadPending = useCallback(async () => {
    setBusy(true); setError("");
    const { data, error: queryError } = await supabase.from("jobs")
      .select("id,title,employer_name,location,category,mode,pay,description,requirements,phone,whatsapp,email,created_at,salary_min,salary_max,salary_currency,pay_period,experience_level,application_deadline")
      .eq("status", "pending_review").order("created_at", { ascending: false }).limit(100);
    if (queryError) setError(queryError.message);
    else setJobs((data ?? []) as PendingJob[]);
    setBusy(false);
  }, []);

  useEffect(() => { if (isAdmin) void loadPending(); }, [isAdmin, reload, loadPending]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) { setError(authError.message); setBusy(false); return; }
    if (data.user?.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      setUser(null);
      setError("This account is not authorized to review jobs. Ask the project owner to assign the admin role in server-managed app metadata.");
      setBusy(false); return;
    }
    setUser(data.user); setPassword(""); setNotice("Administrator access confirmed."); setBusy(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut(); setUser(null); setJobs([]); setNotice(""); setError("");
  };

  const moderate = async (job: PendingJob, status: "published" | "rejected") => {
    if (status === "rejected" && !window.confirm(`Reject “${job.title}” from ${job.employer_name}?`)) return;
    setWorkingId(job.id); setError(""); setNotice("");
    const { data, error: updateError } = await supabase.from("jobs").update({ status })
      .eq("id", job.id).eq("status", "pending_review").select("id").maybeSingle();
    if (updateError) setError(updateError.message);
    else if (!data) setError("This listing was already reviewed, or the current account no longer has admin permission. Refresh and try again.");
    else { setJobs((current) => current.filter((item) => item.id !== job.id)); setNotice(status === "published" ? `Published “${job.title}”. It remains unverified until independently checked.` : `Rejected “${job.title}”.`); }
    setWorkingId("");
  };

  if (checking) return <div className="screen full"><TopBar title="Admin review" /><div className="state" aria-busy="true">Checking administrator session…</div></div>;

  if (!isAdmin) return <div className="screen full admin-screen"><TopBar title="Admin review" />
    <div className="admin-intro"><div className="admin-kicker"><ShieldCheck size={15} /> Restricted workspace</div><h2>Review job submissions</h2><p>Only an approved administrator can access pending listings. Public visitors and ordinary accounts cannot approve jobs.</p></div>
    {error && <div className="admin-alert" role="alert">{error}</div>}
    {user ? <div className="admin-login"><h2>Access not granted</h2><p>This signed-in account does not have the server-managed admin role.</p><button className="btn btn-soft" onClick={() => void signOut()}><LogOut size={16} /> Sign out</button></div> : <div className="admin-login"><h2>Administrator sign in</h2><p>Use an existing Supabase Auth account that the project owner has marked as an administrator. There is no public sign-up here.</p>
      <form className="admin-login-form" onSubmit={signIn}><label>Email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button></form>
    </div>}
  </div>;

  return <div className="screen full admin-screen"><TopBar title="Admin review" right={<button className="icon-btn" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={19} /></button>} />
    <div className="admin-intro"><div className="admin-kicker"><ShieldCheck size={15} /> Administrator workspace</div><h2>Pending job submissions</h2><p>Review details before publishing. Approval does not verify an employer; verification must be performed separately.</p></div>
    <div className="admin-toolbar"><strong>{jobs.length} pending {jobs.length === 1 ? "listing" : "listings"}</strong><button className="btn btn-soft" type="button" onClick={() => setReload((value) => value + 1)} disabled={busy}><RefreshCw size={15} /> Refresh</button></div>
    {error && <div className="admin-alert" role="alert">{error}</div>}{notice && <div className="banner-ok" role="status">{notice}</div>}
    {busy && jobs.length === 0 ? <div className="state">Loading pending listings…</div> : jobs.length === 0 ? <div className="state"><CheckCircle2 size={34} /><h3>No pending jobs</h3><p>New public submissions will appear here for review.</p></div> : <div className="admin-list">{jobs.map((job) => <article className="admin-review-card" key={job.id}>
      <h3>{job.title}</h3><p><b>{job.employer_name}</b></p><div className="admin-review-meta"><span>{job.location}</span><span>{job.category}</span><span>{job.mode}</span><span>{timeAgo(job.created_at)}</span></div>
      <p>{job.description}</p><div className="admin-review-section"><b>Requirements</b><p>{job.requirements}</p></div><div className="admin-review-section"><b>Pay</b><p>{job.pay}{job.salary_min !== null && job.salary_max !== null ? ` · ${job.salary_currency} ${job.salary_min}–${job.salary_max}${job.pay_period ? ` / ${job.pay_period.toLowerCase()}` : ""}` : ""}</p></div>
      {job.application_deadline && <div className="admin-review-meta"><span>Deadline: {job.application_deadline}</span></div>}
      <div className="admin-review-section"><b>Contact</b><p>{[job.phone, job.whatsapp ? `WhatsApp ${job.whatsapp}` : null, job.email].filter(Boolean).join(" · ") || "No contact details"}</p></div>
      <div className="admin-review-actions"><button className="btn btn-primary" type="button" disabled={busy || !!workingId} onClick={() => void moderate(job, "published")}>{workingId === job.id ? "Saving…" : <><CheckCircle2 size={16} /> Approve & publish</>}</button><button className="btn btn-reject" type="button" disabled={busy || !!workingId} onClick={() => void moderate(job, "rejected")}><XCircle size={16} /> Reject</button></div>
    </article>)}</div>}
  </div>;
}
