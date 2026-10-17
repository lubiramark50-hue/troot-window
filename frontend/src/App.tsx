import { Suspense, lazy } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Bookmark, BriefcaseBusiness, Plus, ShieldCheck, MessageCircle, ArrowUpRight, Sparkles, MapPin } from "lucide-react";
import { isConfigured } from "./supabase";
import { LogoMark, ToastProvider } from "./ui";
import Feed from "./screens/Feed";
const Saved = lazy(() => import("./screens/Saved"));
const Messages = lazy(() => import("./screens/Messages"));
const More = lazy(() => import("./screens/More").then((module) => ({ default: module.More })));
const Legal = lazy(() => import("./screens/More").then((module) => ({ default: module.Legal })));
const Detail = lazy(() => import("./screens/Detail"));
const Post = lazy(() => import("./screens/Post"));

function Tabs() {
  const { pathname } = useLocation();
  const item = (to: string, label: string, Icon: typeof Plus, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => "tab" + (isActive ? " on" : "")} aria-current={pathname === to ? "page" : undefined}>
      <Icon size={22} /><span>{label}</span>
    </NavLink>
  );
  return <nav className="tabbar" aria-label="Main">
    {item("/", "Jobs", BriefcaseBusiness, true)}
    {item("/saved", "Saved", Bookmark)}
    {item("/messages", "Messages", MessageCircle)}
    {item("/post", "Post", Plus)}
    {item("/safety", "Safety", ShieldCheck)}
  </nav>;
}

function DesktopNav() {
  const item = (to: string, label: string, Icon: typeof Plus, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => "desk-nav-link" + (isActive ? " active" : "")}>
      <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
    </NavLink>
  );
  return <aside className="desktop-nav">
    <NavLink to="/" className="desktop-brand" aria-label="Troot Window home">
      <LogoMark size={39} /><span><b>Troot Window</b><small>Find your next move</small></span>
    </NavLink>
    <div className="desk-nav-label">WORKSPACE</div>
    <nav className="desk-nav-items" aria-label="Workspace">
      {item("/", "Explore jobs", BriefcaseBusiness, true)}
      {item("/saved", "Saved jobs", Bookmark)}
      {item("/messages", "Messages", MessageCircle)}
    </nav>
    <div className="desk-nav-label desk-nav-label-spaced">YOUR ACTIVITY</div>
    <nav className="desk-nav-items" aria-label="Your activity">
      {item("/post", "Post a vacancy", Plus)}
      {item("/safety", "Trust & safety", ShieldCheck)}
    </nav>
    <div className="desktop-nav-spacer" />
    <div className="nav-help-card">
      <span className="help-icon"><ShieldCheck size={18} /></span>
      <b>Job hunting, safely</b>
      <p>Never pay money to secure a job. Keep your personal details private.</p>
      <NavLink to="/safety">Safety guide <ArrowUpRight size={14} /></NavLink>
    </div>
    <div className="desktop-nav-foot"><span className="online-dot" /> Made for opportunity <span>·</span> Uganda</div>
  </aside>;
}

function DesktopAside() {
  return <aside className="desktop-aside">
    <div className="aside-welcome">
      <div className="aside-eyebrow"><Sparkles size={15} /> A little momentum</div>
      <h2>Your next opportunity could be one click away.</h2>
      <p>Explore real listings, save the ones you like, and contact employers directly.</p>
      <NavLink to="/">Explore jobs <ArrowUpRight size={16} /></NavLink>
    </div>
    <section className="aside-card">
      <div className="aside-card-title"><ShieldCheck size={17} /> Smart job search</div>
      <div className="aside-tip"><span>01</span><p>Check the employer and job details before applying.</p></div>
      <div className="aside-tip"><span>02</span><p>Use the message or contact options on each listing.</p></div>
      <div className="aside-tip"><span>03</span><p>Never pay an application or recruitment fee.</p></div>
    </section>
    <section className="aside-card aside-post-card">
      <div className="aside-post-icon"><Plus size={20} /></div>
      <h3>Hiring someone?</h3>
      <p>Reach people looking for their next opportunity.</p>
      <NavLink to="/post">Post a free job <ArrowUpRight size={15} /></NavLink>
    </section>
    <div className="aside-footer"><MapPin size={13} /> Built for job seekers everywhere</div>
  </aside>;
}

function Workspace() {
  return <div className="workspace">
    <DesktopNav />
    <main className="viewport"><Outlet /></main>
    <DesktopAside />
    <Tabs />
  </div>;
}

const Loading = () => <div className="screen full" aria-busy="true" />;

export default function App() {
  if (!isConfigured) return <div className="state boot"><h3>Setup needed</h3><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.</p></div>;
  return <ToastProvider><Suspense fallback={<Loading />}>
    <Routes>
      <Route element={<Workspace />}>
        <Route path="/" element={<Feed />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/safety" element={<More />} />
        <Route path="/jobs/:id" element={<Detail />} />
        <Route path="/post" element={<Post />} />
        <Route path="/legal/:kind" element={<Legal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </Suspense></ToastProvider>;
}
