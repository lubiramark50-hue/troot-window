import { Suspense, lazy } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Bookmark, BriefcaseBusiness, Plus, ShieldCheck, Search, ArrowUpRight, UsersRound } from "lucide-react";
import { isConfigured } from "./supabase";
import { LogoMark, ToastProvider } from "./ui";
import Feed from "./screens/Feed";
import Saved from "./screens/Saved";
import { Legal, More } from "./screens/More";

const Detail = lazy(() => import("./screens/Detail"));
const Post = lazy(() => import("./screens/Post"));
const WorkerDirectory = lazy(() => import("./screens/Workers"));
const WorkerDetail = lazy(() => import("./screens/Workers").then(m => ({ default: m.WorkerDetail })));
const WorkerAccount = lazy(() => import("./screens/WorkerAccount"));

const entries = [
  { to: "/", label: "Discover jobs", Icon: Search, end: true },
  { to: "/workers", label: "Find a worker", Icon: UsersRound },
  { to: "/saved", label: "Saved jobs", Icon: Bookmark },
  { to: "/post", label: "Post a job", Icon: Plus },
  { to: "/safety", label: "Trust & safety", Icon: ShieldCheck },
] as const;

function Identity({ large = false }: { large?: boolean }) {
  return <NavLink to="/" className="tw-identity" aria-label="Troot Window home">
    <LogoMark size={large ? 42 : 32} />
    <span className="tw-wordmark">Troot <b>Window</b></span>
  </NavLink>;
}

function DesktopSidebar() {
  return <aside className="tw-sidebar">
    <Identity large />
    <p className="tw-side-label">JOB BOARD</p>
    <nav className="tw-side-menu" aria-label="Desktop navigation">
      {entries.map(({ to, label, Icon, ...props }) =>
        <NavLink key={to} to={to} end={"end" in props ? props.end : false} className={({ isActive }) => `tw-side-link${isActive ? " active" : ""}`}>
          <Icon size={19} strokeWidth={2} /><span>{label}</span>
        </NavLink>)}
    </nav>
    <div className="tw-side-grow" />
    <div className="tw-side-message">
      <strong>Before you apply</strong>
      <p>Check the original listing and never pay to apply.</p>
      <NavLink to="/safety">Read safety tips <ArrowUpRight size={14} /></NavLink>
    </div>
    <div className="tw-side-footer">Browse without an account</div>
  </aside>;
}

function MobileTabs() {
  const { pathname } = useLocation();
  const item = (to: string, label: string, Icon: typeof Plus, end = false) =>
    <NavLink to={to} end={end} className={({ isActive }) => `tab${isActive ? " on" : ""}`} aria-current={pathname === to ? "page" : undefined}>
      <Icon size={21} strokeWidth={2} /><span>{label}</span>
    </NavLink>;
  return <nav className="tabbar" aria-label="Main">
    {item("/", "Jobs", BriefcaseBusiness, true)}
    {item("/workers", "Workers", UsersRound)}
    {item("/saved", "Saved", Bookmark)}
    {item("/post", "Post", Plus)}
    {item("/safety", "Safety", ShieldCheck)}
  </nav>;
}

const WithTabs = () => <><main className="viewport"><Outlet /></main><MobileTabs /></>;
const Loading = () => <div className="state" role="status" aria-busy="true">Loading page…</div>;

export default function App() {
  if (!isConfigured) return <div className="state boot"><h3>Setup needed</h3><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.</p></div>;
  return <ToastProvider><div className="tw-app-shell">
    <DesktopSidebar />
    <div className="tw-app-main">
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<WithTabs />}>
            <Route path="/" element={<Feed />} />
            <Route path="/workers" element={<WorkerDirectory />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/safety" element={<More />} />
          </Route>
          <Route path="/workers/account" element={<main className="viewport"><WorkerAccount /></main>} />
          <Route path="/workers/:id" element={<main className="viewport"><WorkerDetail /></main>} />
          <Route path="/jobs/:id" element={<main className="viewport"><Detail /></main>} />
          <Route path="/post" element={<main className="viewport"><Post /></main>} />
          <Route path="/legal/:kind" element={<main className="viewport"><Legal /></main>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  </div></ToastProvider>;
}
