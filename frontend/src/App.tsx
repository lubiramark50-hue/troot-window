import { Suspense, lazy } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Bookmark, BriefcaseBusiness, Plus, ShieldCheck } from "lucide-react";
import { isConfigured } from "./supabase";
import { ToastProvider } from "./ui";
import Feed from "./screens/Feed";
import Saved from "./screens/Saved";
import { Legal, More } from "./screens/More";

const Detail = lazy(() => import("./screens/Detail"));
const Post = lazy(() => import("./screens/Post"));

function Tabs() {
  const { pathname } = useLocation();
  const item = (to: string, label: string, Icon: typeof Plus, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `tab${isActive ? " on" : ""}`} aria-current={pathname === to ? "page" : undefined}>
      <Icon size={22} /><span>{label}</span>
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      {item("/", "Jobs", BriefcaseBusiness, true)}
      {item("/saved", "Saved", Bookmark)}
      {item("/post", "Post", Plus)}
      {item("/safety", "Safety", ShieldCheck)}
    </nav>
  );
}

const WithTabs = () => <><main className="viewport"><Outlet /></main><Tabs /></>;
const Loading = () => <div className="screen full" aria-busy="true" />;

export default function App() {
  if (!isConfigured) {
    return <div className="state boot"><h3>Setup needed</h3><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.</p></div>;
  }
  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<WithTabs />}>
            <Route path="/" element={<Feed />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/safety" element={<More />} />
          </Route>
          <Route path="/jobs/:id" element={<main className="viewport"><Detail /></main>} />
          <Route path="/post" element={<main className="viewport"><Post /></main>} />
          <Route path="/legal/:kind" element={<main className="viewport"><Legal /></main>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
