import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MapPin, Phone, MessageCircle, LocateFixed, Search, UserRound, ArrowRight } from "lucide-react";
import { TopBar } from "../ui";
import { COUNTRIES, SERVICES, contactPhone, getWorker, listWorkers, safeImageUrl, whatsappUrl, type WorkerProfile } from "../workers";

function WorkerPhoto({ worker }: { worker: WorkerProfile }) {
  const src = safeImageUrl(worker.photo_url);
  return src ? <img className="worker-photo" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
    : <span className="worker-photo worker-photo-placeholder"><UserRound size={26} aria-hidden="true" /></span>;
}
function Contact({ worker }: { worker: WorkerProfile }) {
  const phone = contactPhone(worker.phone);
  const whatsapp = worker.whatsapp ? whatsappUrl(worker.whatsapp) : null;
  return <div className="worker-contact">
    {phone && <a className="btn btn-primary" href={"tel:" + phone}><Phone size={17} /> Call worker</a>}
    {whatsapp && <a className="btn btn-soft" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> WhatsApp</a>}
  </div>;
}
function WorkerCard({ worker }: { worker: WorkerProfile }) {
  return <article className="worker-card">
    <Link className="worker-card-link" to={"/workers/" + worker.id}>
      <WorkerPhoto worker={worker} />
      <div className="worker-card-main">
        <h2>{worker.display_name}</h2>
        <p className="worker-muted"><MapPin size={15} /> {worker.town}, {COUNTRIES.find(c => c.code === worker.country_code)?.label ?? worker.country_code}</p>
        <p>{worker.services.join(" · ")}</p>
        <p className="worker-muted">{worker.travel_mode === "fixed" ? "Visit their work location" : "Can travel to customers"}</p>
        <span className="worker-profile-link">View profile <ArrowRight size={15} /></span>
      </div>
    </Link>
    <Contact worker={worker} />
  </article>;
}
export default function WorkerDirectory() {
  const [params, setParams] = useSearchParams();
  const country = params.get("country") || "UG";
  const service = params.get("service") || "Plumbing";
  const town = params.get("town") || "";
  const [results, setResults] = useState<WorkerProfile[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const change = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    let live = true;
    setBusy(true); setError(""); setResults([]);
    listWorkers({ country, service, town }).then(data => { if (live) setResults(data); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Could not load workers."); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [country, service, town, refresh]);
  const locate = () => {
    if (!navigator.geolocation) { setLocationMessage("Location is unavailable. Enter your town instead."); return; }
    setLocating(true); setLocationMessage("");
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        // Only after permission and a button click. Not stored in our database.
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=" +
          encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon);
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Could not identify the town.");
        const json = await response.json();
        const address = json.address || {};
        const detectedCountry = String(address.country_code || "").toUpperCase();
        const detectedTown = String(address.city || address.town || address.municipality || address.village || address.county || address.state_district || "").trim();
        if (!COUNTRIES.some(c => c.code === detectedCountry) || !detectedTown)
          throw new Error("We could not detect a supported town. Please enter it manually.");
        const next = new URLSearchParams(params);
        next.set("country", detectedCountry); next.set("town", detectedTown);
        setParams(next, { replace: true });
        setLocationMessage("Approximate area detected: " + detectedTown + ". You can change it.");
      } catch (e) {
        setLocationMessage(e instanceof Error ? e.message : "Enter your town manually.");
      } finally { setLocating(false); }
    }, () => { setLocating(false); setLocationMessage("Location access was denied or unavailable. Enter your town manually."); }, { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false });
  };
  return <div className="screen worker-page">
    <header className="worker-header">
      <div><p className="worker-kicker">LOCAL SERVICES</p><h1 className="large-title">Find a worker</h1><p>Find local tradespeople and service providers. Browse and contact anyone without signing in.</p></div>
      <Link className="btn btn-soft" to="/workers/account">I'm a worker</Link>
    </header>
    <section className="worker-panel" aria-label="Search workers">
      <div className="worker-fields">
        <label>Service needed
          <select value={service} onChange={e => change("service", e.target.value)}>{SERVICES.map(x => <option key={x}>{x}</option>)}</select>
        </label>
        <label>Country
          <select value={country} onChange={e => { const next = new URLSearchParams(params); next.set("country", e.target.value); next.delete("town"); setParams(next); }}>{COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}</select>
        </label>
        <label>Town or area
          <input value={town} maxLength={100} placeholder="e.g. Kampala" onChange={e => change("town", e.target.value)} />
        </label>
      </div>
      <button type="button" className="worker-location" onClick={locate} disabled={locating}><LocateFixed size={17} /> {locating ? "Finding your area…" : "Use my approximate location"}</button>
      <p className="worker-muted worker-location-note">Optional. With permission, OpenStreetMap receives your approximate coordinates to identify a town. You can always search manually. Geocoding data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>.</p>
      {locationMessage && <p role="status" className="worker-message">{locationMessage}</p>}
    </section>
    <div className="worker-results-head"><h2><Search size={19} /> Available listings</h2><small>Matched by country, service and areas served, not exact distance</small></div>
    {busy ? <div className="state" role="status" aria-busy="true">Loading worker profiles…</div> :
      error ? <div className="state" role="alert"><h3>Couldn't load workers</h3><p>{error}</p><button className="btn btn-primary" onClick={() => setRefresh(n => n+1)}>Try again</button></div> :
      results.length ? <div className="worker-list">{results.map(worker => <WorkerCard key={worker.id} worker={worker} />)}</div> :
      <div className="state worker-empty"><h3>No matching workers yet</h3><p>Try another service or town. Workers must opt into a public listing before they appear here.</p><Link to="/workers/account" className="btn btn-soft">Register as a worker</Link></div>}
  </div>;
}
export function WorkerDetail() {
  const { id = "" } = useParams();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true; setBusy(true);
    getWorker(id).then(result => { if (live) setWorker(result); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Unable to load profile."); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [id]);
  return <div className="screen full worker-page">
    <TopBar title="Worker profile" />
    {busy ? <div className="state" role="status">Loading profile…</div> :
      error ? <div className="state" role="alert"><h3>Couldn't load profile</h3><p>{error}</p></div> :
      !worker ? <div className="state"><h3>Profile unavailable</h3><p>This worker may have paused their listing.</p><Link to="/workers" className="btn btn-soft">Browse workers</Link></div> :
      <article className="worker-detail worker-panel">
        <div className="worker-detail-head"><WorkerPhoto worker={worker} /><div><h1>{worker.display_name}</h1><p><MapPin size={16} /> {worker.town}, {COUNTRIES.find(c => c.code === worker.country_code)?.label ?? worker.country_code}</p><p>{worker.availability}</p></div></div>
        <h2>Services</h2><p>{worker.services.join(" · ")}</p>
        {worker.skills && <><h2>Skills</h2><p>{worker.skills}</p></>}
        {worker.description && <><h2>About</h2><p className="worker-pre">{worker.description}</p></>}
        {worker.work_examples && <><h2>Work examples</h2><p className="worker-pre">{worker.work_examples}</p></>}
        <h2>Service area</h2><p>{worker.travel_mode === "fixed" ? "Work at my location" : "I travel to customers"} · {worker.town}{worker.service_areas.length ? " · " + worker.service_areas.join(", ") : ""}</p>
        {worker.experience_years !== null && <p>{worker.experience_years} years of experience</p>}
        {worker.starting_price && <p>Starting price: {worker.starting_price} (confirm with worker)</p>}
        <Contact worker={worker} />
        <p className="worker-muted worker-caution">Troot Window has not verified this worker's identity or qualifications. Agree on cost and safety arrangements before work begins.</p>
      </article>}
  </div>;
}

