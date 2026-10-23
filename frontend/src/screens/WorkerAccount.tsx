import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { CheckCircle2, LogOut, LocateFixed } from "lucide-react";
import { TopBar } from "../ui";
import { detectCurrentArea } from "../worker-location";
import { workerSupabase } from "../supabase";
import { COUNTRIES, SERVICES, preferredCountry, validCountryCode, contactPhone, getOwnProfile, saveOwnProfile, safeImageUrl, type TravelMode, type WorkerInput, type OwnProfile } from "../workers";

type Mode = "login" | "signup" | "forgot" | "reset";
type Fields = {
  display_name: string; services: string[]; skills: string; country_code: string;
  town: string; service_areas: string; travel_mode: TravelMode; availability: string;
  phone: string; whatsapp: string; description: string; work_examples: string;
  photo_url: string; experience_years: string; starting_price: string; is_active: boolean;
};
const empty: Fields = {
  display_name: "", services: [], skills: "", country_code: "UG", town: "",
  service_areas: "", travel_mode: "mobile", availability: "Ask for availability",
  phone: "", whatsapp: "", description: "", work_examples: "", photo_url: "",
  experience_years: "", starting_price: "", is_active: false,
};
function newProfileFields(): Fields {
  return { ...empty, country_code: preferredCountry(typeof navigator !== "undefined" ? navigator.languages : []) };
}
function fromProfile(p: OwnProfile): Fields {
  return {
    display_name: p.display_name, services: p.services, skills: p.skills, country_code: p.country_code,
    town: p.town, service_areas: p.service_areas.join(", "), travel_mode: p.travel_mode,
    availability: p.availability, phone: p.phone, whatsapp: p.whatsapp ?? "",
    description: p.description, work_examples: p.work_examples, photo_url: p.photo_url ?? "",
    experience_years: p.experience_years === null ? "" : String(p.experience_years),
    starting_price: p.starting_price ?? "", is_active: p.is_active,
  };
}
function checkProfile(form: Fields): string | null {
  if (form.display_name.trim().length < 2) return "Enter the name customers will see.";
  if (!form.services.length) return "Choose at least one service.";
  if (form.services.length > 12) return "Choose no more than 12 services.";
  if (!validCountryCode(form.country_code)) return "Choose a country for your worker listing.";
  if (form.town.trim().length < 2) return "Enter a city, town or district.";
  if (!contactPhone(form.phone)) return "Enter your phone number with its international country dialling code, e.g. +1 202 555 0123.";
  if (form.whatsapp.trim() && !contactPhone(form.whatsapp)) return "WhatsApp must use an international number.";
  if (form.photo_url.trim() && !safeImageUrl(form.photo_url.trim())) return "Photo link must start with https://.";
  if (form.experience_years && (!/^\d+$/.test(form.experience_years) || Number(form.experience_years) > 70)) return "Years of experience must be between 0 and 70.";
  if (form.service_areas.split(",").filter(Boolean).length > 25) return "Enter no more than 25 service areas.";
  return null;
}
export default function WorkerAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState<Fields>(newProfileFields);
  const [hasProfile, setHasProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [profileRetry, setProfileRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [locatingProfile, setLocatingProfile] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState("");
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);

  useEffect(() => {
    let live = true;
    const { data: { subscription } } = workerSupabase.auth.onAuthStateChange((event, session) => {
      if (!live) return;
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setMode("reset");
      setChecking(false);
    });
    workerSupabase.auth.getSession().then(({ data, error: problem }) => {
      if (!live) return;
      if (problem) setError(problem.message);
      setUser(data.session?.user ?? null); setChecking(false);
    }).catch(() => { if (live) setChecking(false); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!user) { setHasProfile(false); setProfileLoadFailed(false); setForm(newProfileFields()); return; }
    let live = true;
    setLoadingProfile(true); setProfileLoadFailed(false); setError("");
    getOwnProfile(user.id).then(profile => {
      if (!live) return;
      setHasProfile(!!profile);
      setForm(profile ? fromProfile(profile) : newProfileFields());
    }).catch(e => { if (live) { setProfileLoadFailed(true); setError(e instanceof Error ? e.message : "Unable to load your profile."); } })
      .finally(() => { if (live) setLoadingProfile(false); });
    return () => { live = false; };
  }, [user?.id, profileRetry]);
  const edit = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    if (key === "country_code" || key === "town") {
      locationRequest.current += 1; setLocatingProfile(false); setLocationFeedback("");
    }
    setForm(f => ({ ...f, [key]: value }));
  };
  const locateProfile = async () => {
    const request = ++locationRequest.current;
    setLocatingProfile(true); setLocationFeedback("");
    try {
      const area = await detectCurrentArea();
      if (locationRequest.current !== request) return;
      setForm(current => ({ ...current, country_code: area.country, town: area.town }));
      setLocationFeedback("Approximate location selected: " + area.town + ". Check that this is the town where you offer services.");
    } catch (e) {
      if (locationRequest.current === request)
        setLocationFeedback(e instanceof Error ? e.message : "Could not find your town. Enter it manually.");
    } finally { if (locationRequest.current === request) setLocatingProfile(false); }
  };
  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        const { error: problem } = await workerSupabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/workers/account" });
        if (problem) throw problem;
        setMessage("If this email has an account, a recovery link will be sent. Check your inbox.");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error("Use at least eight characters.");
        const { error: problem } = await workerSupabase.auth.updateUser({ password });
        if (problem) throw problem;
        setMode("login"); setPassword(""); setMessage("Password updated.");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least eight characters.");
        const { data, error: problem } = await workerSupabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin + "/workers/account" },
        });
        if (problem) throw problem;
        if (!data.session) setMessage("Check your email for a confirmation link, then return here to sign in. If the address was already registered, use password recovery.");
        else setMessage("Account created. Complete your public profile below.");
      } else {
        const { error: problem } = await workerSupabase.auth.signInWithPassword({ email, password });
        if (problem) throw problem;
        setMessage("Signed in.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to continue."); }
    finally { setBusy(false); }
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!user || loadingProfile || profileLoadFailed) return;
    setError(""); setMessage("");
    const invalid = checkProfile(form);
    if (invalid) { setError(invalid); return; }
    const areas = [...new Set(form.service_areas.split(",").map(x => x.trim()).filter(Boolean))];
    const payload: WorkerInput = {
      user_id: user.id, display_name: form.display_name.trim(), services: form.services,
      skills: form.skills.trim(), country_code: form.country_code,
      town: form.town.trim(), service_areas: areas, travel_mode: form.travel_mode,
      availability: form.availability, phone: contactPhone(form.phone)!,
      whatsapp: form.whatsapp.trim() ? contactPhone(form.whatsapp)! : null,
      description: form.description.trim(), work_examples: form.work_examples.trim(),
      photo_url: form.photo_url.trim() || null,
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      starting_price: form.starting_price.trim() || null, is_active: form.is_active,
    };
    setBusy(true);
    try {
      await saveOwnProfile(payload);
      setHasProfile(true);
      setMessage(payload.is_active ? "Public profile saved. Customers can now find you." : "Profile saved privately. Your listing is paused.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the profile."); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setError(""); setMessage("");
    const { error: problem } = await workerSupabase.auth.signOut();
    if (problem) setError(problem.message); else { setMode("login"); setMessage("Signed out."); }
  };
  return <div className="screen full worker-page">
    <TopBar title="Worker account" />
    <div className="worker-panel worker-account">
      {checking ? <p role="status">Checking session…</p> :
        !user || mode === "reset" ? <>
          <h1>{mode === "signup" ? "Register as a worker" : mode === "forgot" ? "Recover your password" : mode === "reset" ? "Choose a new password" : "Worker sign in"}</h1>
          <p className="worker-muted">Customers do not need an account. Only workers sign in to manage their listings.</p>
          <form className="worker-auth-form" onSubmit={submitAuth}>
            {mode !== "reset" && <label>Email address<input type="email" autoComplete="email" value={email} required maxLength={254} onChange={e => setEmail(e.target.value)} /></label>}
            {mode !== "forgot" && <label>{mode === "reset" ? "New password" : "Password"}<input type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} /></label>}
            {error && <p className="banner-err" role="alert">{error}</p>}
            {message && <p className="worker-message" role="status">{message}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send recovery email" : mode === "reset" ? "Update password" : "Sign in"}</button>
          </form>
          <div className="worker-account-links">
            {mode !== "reset" && <><button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setMessage(""); }}>{mode === "signup" ? "Already registered? Sign in" : "New worker? Register"}</button><button onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setError(""); setMessage(""); }}>{mode === "forgot" ? "Return to sign in" : "Forgot password?"}</button></>}
          </div>
        </> : loadingProfile ? <p role="status">Loading your profile…</p> : profileLoadFailed ? <div className="state" role="alert">
          <h1>Unable to load your profile</h1>
          <p>{error || "Your profile is temporarily unavailable."} Editing is disabled until your existing information can be loaded safely.</p>
          <button className="btn btn-primary" type="button" onClick={() => setProfileRetry(n => n + 1)}>Retry loading profile</button>
          <button className="btn btn-soft" type="button" onClick={logout}><LogOut size={16} /> Log out</button>
        </div> : <>
          <div className="worker-account-heading"><div><h1>Your worker profile</h1><p className="worker-muted">Signed in as {user.email}</p></div><button className="btn btn-soft" type="button" onClick={logout}><LogOut size={16} /> Log out</button></div>
          <p className="worker-muted">Your email and password are private. Only the profile information you choose to publish is visible to customers.</p>
          {error && <p className="banner-err" role="alert">{error}</p>}
          {message && <p className="worker-message" role="status"><CheckCircle2 size={16} /> {message}</p>}
          <form className="worker-form" onSubmit={saveProfile}>
            <label>Public name<input value={form.display_name} onChange={e => edit("display_name", e.target.value)} maxLength={100} required /></label>
            <fieldset><legend>Services offered</legend><div className="worker-checks">{SERVICES.map(s => <label key={s}><input type="checkbox" checked={form.services.includes(s)} onChange={e => edit("services", e.target.checked ? [...form.services,s] : form.services.filter(x => x !== s))} /> {s}</label>)}</div></fieldset>
            <label>Skills and specialties<input value={form.skills} onChange={e => edit("skills", e.target.value)} maxLength={600} placeholder="e.g. bathroom installations, solar wiring" /></label>
            <div className="worker-fields two">
              <label>Country<select value={form.country_code} onChange={e => edit("country_code", e.target.value)}>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
              <label>City or town<input value={form.town} onChange={e => edit("town", e.target.value)} maxLength={100} required /></label>
            </div>
            <div className="worker-location-actions">
              <button className="worker-location" type="button" onClick={locateProfile} disabled={locatingProfile} aria-busy={locatingProfile}><LocateFixed size={17} /> {locatingProfile ? "Detecting your town…" : "Use my approximate location"}</button>
            </div>
            {locationFeedback && <p role="status" className="worker-message">{locationFeedback}</p>}
            <p className="worker-muted worker-location-note">Optional. Your approximate coordinates go to BigDataCloud for town detection (OpenStreetMap fallback); they are not stored in your profile. You can always type or correct the town yourself.</p>
            <label>Other towns/areas you serve (in the selected country), separated by commas<input value={form.service_areas} onChange={e => edit("service_areas", e.target.value)} placeholder="e.g. Brooklyn, Queens" maxLength={1200} /></label>
            <div className="worker-fields two">
              <label>Where you work<select value={form.travel_mode} onChange={e => edit("travel_mode", e.target.value as TravelMode)}><option value="mobile">I travel to customers</option><option value="fixed">Customers visit me</option><option value="both">Both</option></select></label>
              <label>Availability<select value={form.availability} onChange={e => edit("availability", e.target.value)}>{["Available","Limited availability","Unavailable","Ask for availability"].map(x => <option key={x}>{x}</option>)}</select></label>
            </div>
            <div className="worker-fields two">
              <label>Public contact phone<input type="tel" value={form.phone} onChange={e => edit("phone", e.target.value)} placeholder="e.g. +44 7700 900123" maxLength={25} required /></label>
              <label>WhatsApp (optional)<input type="tel" value={form.whatsapp} onChange={e => edit("whatsapp", e.target.value)} placeholder="e.g. +44 7700 900123" maxLength={25} /></label>
            </div>
            <label>About your work<textarea value={form.description} onChange={e => edit("description", e.target.value)} rows={4} maxLength={1200} /></label>
            <label>Examples of previous work (description)<textarea value={form.work_examples} onChange={e => edit("work_examples", e.target.value)} rows={3} maxLength={1200} /></label>
            <div className="worker-fields two">
              <label>Years of experience (optional)<input type="number" min={0} max={70} value={form.experience_years} onChange={e => edit("experience_years", e.target.value)} /></label>
              <label>Starting price (optional)<input value={form.starting_price} onChange={e => edit("starting_price", e.target.value)} maxLength={100} placeholder="e.g. UGX 50,000" /></label>
            </div>
            <label>Public profile photo URL (optional)<input type="url" value={form.photo_url} onChange={e => edit("photo_url", e.target.value)} placeholder="https://..." maxLength={500} /></label>
            <label className="worker-publish"><input type="checkbox" checked={form.is_active} onChange={e => edit("is_active", e.target.checked)} /><span><b>Publish my worker listing</b><small>Turn this off to pause your public profile and contact details immediately after saving.</small></span></label>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : hasProfile ? "Save changes" : "Create profile"}</button>
            {hasProfile && form.is_active && <Link to="/workers" className="worker-profile-link">Browse public workers</Link>}
          </form>
        </>}
    </div>
  </div>;
}

