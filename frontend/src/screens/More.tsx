import { Link, useParams } from "react-router-dom";
import { BadgeCheck, ChevronRight, FileText, Flag, HandCoins, Lock, ShieldCheck } from "lucide-react";
import { LogoMark, TopBar } from "../ui";

const tips = [
  { icon: HandCoins, t: "Never pay to get a job", d: "Real employers do not charge application, training or registration fees." },
  { icon: Lock, t: "Protect your details", d: "Never share passwords, OTPs, PINs or bank details with an employer." },
  { icon: Flag, t: "Report anything off", d: "Use Report this job on a suspicious listing to send it for review." },
];

export function More() {
  return (
    <div className="screen">
      <header className="home-head"><h1 className="large-title">Safety</h1></header>
      <div className="card-group">
        {tips.map(({ icon: I, t, d }) => <div className="tip" key={t}><span className="tip-ico"><I size={20} /></span><div><b>{t}</b><p>{d}</p></div></div>)}
      </div>
      <div className="card-group">
        <div className="tip"><span className="tip-ico green"><BadgeCheck size={20} /></span><div><b>What Verified means</b><p>The listing comes from an approved employer’s own hiring feed. Public feed listings and direct submissions do not receive this badge. Always check the original posting.</p></div></div>
      </div>
      <div className="card-group menu">
        <Link to="/legal/privacy"><ShieldCheck size={19} />Privacy<ChevronRight size={18} /></Link>
        <Link to="/legal/terms"><FileText size={19} />Terms of use<ChevronRight size={18} /></Link>
      </div>
      <div className="about"><LogoMark size={40} /><b>Troot Window</b><small>Version {(import.meta.env.VITE_BUILD_SHA || "dev").slice(0, 7)}</small></div>
    </div>
  );
}

const legal: Record<string, { title: string; body: string[] }> = {
  privacy: { title: "Privacy", body: [
    "You can browse and apply without an account. We do not ask for your name or location to search.",
    "Saved jobs stay on your device. When you post a job or report a listing, we store what you submit and a one-way hash of your network address to prevent abuse. We never store the raw address.",
    "Contact details you add to a job are shown publicly as soon as you post it. Only add details you are happy to share.",
    "To ask us to remove a listing or any data, contact the team through the address on our store listing." ] },
  terms: { title: "Terms of use", body: [
    "Troot Window connects workers and employers. We remove listings that break our rules, but we cannot guarantee any employer or job.",
    "Employers must post honest, lawful jobs and must not charge applicants fees. Listings that break these rules are removed.",
    "Verified identifies listings from approved employers’ own hiring feeds. It is not a guarantee of the employer or the job.",
    "Always confirm details yourself before accepting work." ] },
};

export function Legal() {
  const { kind = "" } = useParams();
  const page = legal[kind];
  return (
    <div className="screen full">
      <TopBar title={page?.title ?? "Not found"} />
      <div className="detail">{page ? page.body.map((p, i) => <p className="prose" key={i}>{p}</p>) : <p className="prose">This page does not exist.</p>}</div>
    </div>
  );
}
