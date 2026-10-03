import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  BriefcaseBusiness, CheckCircle2, ChevronRight, HeartHandshake,
  Mail, MapPin, Phone, Search, ShieldCheck, UserRound, UsersRound,
  WalletCards, MessageCircle, Plus, X, Megaphone
} from "lucide-react";

type Job = {
  id: string;
  title: string;
  employer: string;
  location: string;
  category: string;
  mode: string;
  pay: string;
  summary: string;
  requirements: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  verified: boolean;
  posted: string;
};

const starterJobs: Job[] = [
  {
    id: "1", title: "Site Carpenter", employer: "Kampala BuildWorks", location: "Kampala",
    category: "Construction", mode: "On-site", pay: "UGX 35k–50k/day",
    summary: "Residential finishing and formwork work. Start immediately.",
    requirements: ["Carpentry", "Formwork", "Site safety"], phone: "+256700000001",
    whatsapp: "256700000001", email: "jobs@example.com", verified: true, posted: "Today"
  },
  {
    id: "2", title: "Junior C# Developer", employer: "LakeHub Digital", location: "Kampala",
    category: "Technology", mode: "Hybrid", pay: "UGX 1.2m–1.8m/month",
    summary: "Build APIs and business applications with ASP.NET Core.",
    requirements: ["C#", "ASP.NET Core", "SQL"], email: "careers@example.com",
    verified: true, posted: "Today"
  },
  {
    id: "3", title: "Electrician", employer: "BrightLine Services", location: "Entebbe",
    category: "Trades", mode: "On-site", pay: "UGX 45k–70k/day",
    summary: "Domestic electrical installation and maintenance.",
    requirements: ["Wiring", "Solar", "Maintenance"], phone: "+256700000003",
    whatsapp: "256700000003", verified: false, posted: "Yesterday"
  }
];

const storageKey = "troot-window-jobs";

function loadJobs(): Job[] {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : starterJobs;
  } catch { return starterJobs; }
}

function Logo() {
  return <Link className="brand" to="/"><span className="logo-mark">T</span><span>Troot Window</span></Link>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [showPost, setShowPost] = useState(false);
  return (
    <div className="shell">
      <header>
        <Logo />
        <nav>
          <Link to="/jobs">Find jobs</Link>
          <Link to="/workers">Workers</Link>
          <button className="nav-post" onClick={() => setShowPost(true)}><Plus size={17}/> Post a job</button>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <strong>Troot Window</strong><span>Find work. Hire people. Keep it simple.</span>
        <div><Link to="/trust">Trust & Safety</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
      </footer>
      {showPost && <PostModal onClose={() => setShowPost(false)} />}
    </div>
  );
}

function AdSlot({ label = "Sponsored" }: { label?: string }) {
  return <aside className="ad-slot" aria-label="Advertisement">
    <span><Megaphone size={14}/> {label}</span>
    <div><strong>Support local businesses</strong><small>Relevant offers only. Never a pop-up or full-screen interruption.</small></div>
  </aside>;
}

function Home() {
  const nav = useNavigate();
  return <section className="home page">
    <div className="home-copy">
      <span className="eyebrow"><HeartHandshake size={16}/> WORK WITH TRUST</span>
      <h1>Find work.<br/><em>Find the right people.</em></h1>
      <p className="lead">Search real job opportunities and contact employers directly. <strong>No account is required to look for a job.</strong></p>
      <div className="home-search">
        <Search size={20}/>
        <input aria-label="Search jobs" placeholder="Job, skill, company or location" onKeyDown={e => e.key === "Enter" && nav("/jobs?q=" + encodeURIComponent(e.currentTarget.value))}/>
        <button className="primary" onClick={() => nav("/jobs")}>Find jobs</button>
      </div>
      <div className="trust-row"><span><ShieldCheck size={16}/> Verification labels</span><span><Phone size={16}/> Direct contact</span><span><UserRound size={16}/> Login optional</span></div>
    </div>
    <div className="home-card soft">
      <div className="mini-stat"><BriefcaseBusiness size={22}/><div><b>Jobs that explain themselves</b><small>Pay, location, requirements and contact details are shown clearly.</small></div></div>
      <div className="mini-stat"><UsersRound size={22}/><div><b>Hire without the runaround</b><small>Employers can post a clear job and receive direct enquiries.</small></div></div>
      <div className="mini-stat"><ShieldCheck size={22}/><div><b>Trust comes first</b><small>Verified employers are clearly marked. Report suspicious listings.</small></div></div>
    </div>
  </section>;
}

function Jobs() {
  const params = new URLSearchParams(location.search);
  const [jobs] = useState(loadJobs);
  const [q, setQ] = useState(params.get("q") || "");
  const [category, setCategory] = useState("All");
  const [mode, setMode] = useState("All");
  const filtered = useMemo(() => jobs.filter(j => {
    const text = [j.title,j.employer,j.location,j.category,...j.requirements].join(" ").toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (category === "All" || j.category === category) && (mode === "All" || j.mode === mode);
  }), [jobs,q,category,mode]);

  return <section className="page">
    <div className="page-head"><div><span className="eyebrow">FOR WORKERS</span><h2>Jobs worth opening.</h2><p>Search first. Apply when the details make sense.</p></div><Link className="secondary" to="/post-job"><Plus size={17}/> Post a job</Link></div>
    <div className="filters soft">
      <div className="search-control"><Search size={18}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search jobs, skills or employers"/></div>
      <select value={category} onChange={e => setCategory(e.target.value)}><option>All</option><option>Construction</option><option>Technology</option><option>Trades</option><option>Hospitality</option><option>Transport</option><option>Other</option></select>
      <select value={mode} onChange={e => setMode(e.target.value)}><option>All</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select>
    </div>
    <div className="result-line">{filtered.length} {filtered.length === 1 ? "job" : "jobs"} found</div>
    {filtered.length === 0 && <div className="empty soft"><Search size={30}/><h3>No matching jobs</h3><p>Try another skill, location or category.</p></div>}
    <div className="job-grid">
      {filtered.map((job, i) => <div key={job.id} className="job-wrap">
        <JobCard job={job}/>
        {i === 1 && <AdSlot/>}
      </div>)}
    </div>
  </section>;
}

function JobCard({job}: {job: Job}) {
  return <article className="job-card soft">
    <div className="job-top"><span className="job-icon"><BriefcaseBusiness size={19}/></span><span className="mode">{job.mode}</span></div>
    <h3>{job.title}</h3>
    <p className="employer">{job.employer} <span>•</span> {job.location}</p>
    <strong className="pay">{job.pay}</strong>
    <p>{job.summary}</p>
    <div className="tags">{job.requirements.slice(0,3).map(s=><span key={s}>{s}</span>)}</div>
    <div className="card-bottom">{job.verified ? <span className="verified"><CheckCircle2 size={15}/> Verified employer</span> : <span className="muted">Verification pending</span>}<Link to={"/jobs/"+job.id}>View details <ChevronRight size={16}/></Link></div>
  </article>;
}

function Detail() {
  const {id} = useParams();
  const job = loadJobs().find(j => j.id === id);
  if (!job) return <section className="page narrow"><h2>Job not found</h2><Link to="/jobs">Back to jobs</Link></section>;
  const whatsapp = job.whatsapp?.replace(/\D/g,"");
  const message = encodeURIComponent(`Hello, I found your "${job.title}" job on Troot Window and would like to apply. Please share the next steps.`);
  return <section className="page narrow">
    <Link className="back" to="/jobs">← Back to jobs</Link>
    <article className="detail soft">
      <span className="eyebrow">{job.category} · {job.mode}</span>
      <h2>{job.title}</h2>
      <p className="employer large">{job.employer} · {job.location}</p>
      {job.verified && <div className="verify-banner"><ShieldCheck size={21}/><div><b>Verified employer</b><small>The employer has completed the platform's verification check.</small></div></div>}
      <h3>About this job</h3><p>{job.summary}</p>
      <h3>Pay</h3><p className="pay large">{job.pay}</p>
      <h3>Requirements</h3><ul className="requirements">{job.requirements.map(r=><li key={r}><CheckCircle2 size={17}/>{r}</li>)}</ul>
      <div className="contact-box">
        <div><span className="eyebrow">CONTACT EMPLOYER DIRECTLY</span><h3>No login required</h3><p>Use the contact method the employer provided. Never send passwords, OTPs or banking credentials.</p></div>
        <div className="contact-actions">
          {job.whatsapp && <a className="contact whatsapp" href={`https://wa.me/${whatsapp}?text=${message}`}><MessageCircle size={18}/> WhatsApp</a>}
          {job.phone && <a className="contact phone" href={`tel:${job.phone}`}><Phone size={18}/> Call</a>}
          {job.email && <a className="contact email" href={`mailto:${job.email}?subject=${encodeURIComponent("Application: "+job.title)}&body=${message}`}><Mail size={18}/> Email</a>}
        </div>
      </div>
      <button className="report" onClick={() => alert("Thanks. The listing has been flagged for review.")}>Report this job</button>
    </article>
  </section>;
}

function PostModal({onClose}:{onClose:()=>void}) {
  const nav=useNavigate();
  const submit=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    const job:Job={
      id:crypto.randomUUID(), title:String(data.get("title")), employer:String(data.get("employer")),
      location:String(data.get("location")), category:String(data.get("category")), mode:String(data.get("mode")),
      pay:String(data.get("pay")), summary:String(data.get("summary")), requirements:String(data.get("requirements")).split(",").map(x=>x.trim()).filter(Boolean),
      phone:String(data.get("phone")||""), whatsapp:String(data.get("whatsapp")||""), email:String(data.get("email")||""),
      verified:false, posted:"Just now"
    };
    const jobs=[...loadJobs(),job]; localStorage.setItem(storageKey,JSON.stringify(jobs));
    onClose(); nav("/jobs/"+job.id);
  };
  return <div className="modal-backdrop"><div className="modal soft"><button className="close" onClick={onClose} aria-label="Close"><X/></button><span className="eyebrow">FOR EMPLOYERS</span><h2>Post a clear job.</h2><p>Make it easy for the right person to contact you. Login is not required to browse jobs.</p>
    <form className="form" onSubmit={submit}>
      <label>Job title<input name="title" required placeholder="e.g. Driver, Mason, Accountant"/></label>
      <label>Company / employer<input name="employer" required placeholder="Your business or name"/></label>
      <div className="two"><label>Location<input name="location" required placeholder="e.g. Kampala"/></label><label>Pay / budget<input name="pay" required placeholder="e.g. UGX 50k/day"/></label></div>
      <div className="two"><label>Category<select name="category"><option>Construction</option><option>Technology</option><option>Trades</option><option>Hospitality</option><option>Transport</option><option>Other</option></select></label><label>Work type<select name="mode"><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label></div>
      <label>What will the worker do?<textarea name="summary" required rows={3} placeholder="Explain the actual work, schedule and expectations."/></label>
      <label>Requirements <small>Separate skills with commas</small><input name="requirements" required placeholder="Experience, driving licence, welding"/></label>
      <h3>Contact details</h3><p className="muted">At least one is recommended. These are shown to people viewing the job.</p>
      <div className="two"><label>Phone<input name="phone" placeholder="+256..."/></label><label>WhatsApp number<input name="whatsapp" placeholder="256..."/></label></div>
      <label>Email<input name="email" type="email" placeholder="jobs@company.com"/></label>
      <button className="primary" type="submit">Publish job <ChevronRight size={17}/></button>
    </form>
  </div></div>;
}

function PostPage(){ const [open,setOpen]=useState(true); return open ? <PostModal onClose={()=>setOpen(false)}/> : <section className="page narrow"><h2>Ready when you are.</h2><Link to="/jobs">Find jobs</Link></section>; }
function Workers(){return <section className="page"><span className="eyebrow">FOR EMPLOYERS</span><h2>Find people, not profiles.</h2><p className="lead">Worker discovery is being built around skills, availability and verification—not vanity metrics.</p><div className="worker-note soft"><UsersRound size={28}/><div><h3>Simple and safe hiring</h3><p>Employers will be able to search verified skills and contact workers directly, while keeping personal information under the worker's control.</p></div></div></section>}
function Legal({kind}:{kind:string}){return <section className="page narrow"><span className="eyebrow">TROOT WINDOW</span><h2>{kind}</h2><article className="soft legal"><h3>Built for legitimate hiring</h3><p>Use clear job details, truthful contact information and appropriate verification. Never pay an employer to apply for a job.</p><p>Never share passwords, OTPs or banking credentials through a hiring conversation. Report suspicious listings so they can be reviewed.</p></article></section>}

export default function App(){
  return <Shell><Routes>
    <Route path="/" element={<Home/>}/><Route path="/jobs" element={<Jobs/>}/><Route path="/jobs/:id" element={<Detail/>}/>
    <Route path="/workers" element={<Workers/>}/><Route path="/post-job" element={<PostPage/>}/>
    <Route path="/trust" element={<Legal kind="Trust & Safety"/>}/><Route path="/privacy" element={<Legal kind="Privacy"/>}/><Route path="/terms" element={<Legal kind="Terms"/>}/>
  </Routes></Shell>;
}
