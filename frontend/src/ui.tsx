import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronLeft } from "lucide-react";
import type { Job } from "./api";
import { employerLogoUrl } from "./company-logos";

/* ---------- Brand ---------- */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/troot-window-logo.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="logo-mark"
      style={{ objectFit: "contain", boxShadow: "none", borderRadius: 0 }}
    />
  );
}

/* ---------- Saved jobs (local, synced across tabs) ---------- */
const KEY = "troot:saved";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
const read = (): string[] => {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    cache = Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 100) : [];
  } catch { cache = []; }
  return cache;
};
const write = (next: string[]) => {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function useSaved() {
  const ids = useSyncExternalStore(subscribe, read, read);
  const toggle = useCallback((id: string) => {
    const cur = read();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 100));
  }, []);
  return { ids, has: (id: string) => ids.includes(id), toggle };
}

/* ---------- Toast ---------- */
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const timer = useRef<number>(0);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(""), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">{msg && <div className="toast">{msg}</div>}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- Bars ---------- */
export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => (history.length > 1 ? nav(-1) : nav("/"))} aria-label="Back"><ChevronLeft size={24} /></button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

/* ---------- Helpers ---------- */
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
export const tone = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 4; };
export const splitReq = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
export const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
/** A recognizable company mark where a verified employer domain is known.
 * For employers without a trustworthy logo, show a neutral company icon rather
 * than initials or, worse, an unrelated job board's branding. */
export function Avatar({ job, size = 46 }: { job: Pick<Job, "employerName" | "companyDomain" | "source">; size?: number }) {
  const url = employerLogoUrl(job);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const useLogo = !!url && failedUrl !== url;
  return <span className="avatar company-avatar" style={{ width: size, height: size }}>
    {useLogo
      ? <img className="company-avatar-img" src={url} alt="" loading={size >= 58 ? "eager" : "lazy"}
          decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
      : <Building2 className="company-avatar-placeholder" size={Math.round(size * 0.46)} strokeWidth={1.8} aria-hidden="true" />}
  </span>;
}
