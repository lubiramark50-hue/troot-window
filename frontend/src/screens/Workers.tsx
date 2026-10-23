import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MapPin, Phone, MessageCircle, LocateFixed, Search, UserRound, ArrowRight } from "lucide-react";
import { TopBar } from "../ui";
import { detectCurrentArea } from "../worker-location";
import { COUNTRIES, SERVICES, WORKER_PAGE_SIZE, countryLabel, preferredCountry, validCountryCode, contactPhone, getWorker, listWorkers, safeImageUrl, whatsappUrl, type WorkerProfile } from "../workers";

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
        <p className="worker-muted"><MapPin size={15} /> {worker.town}, {countryLabel(worker.country_code)}</p>
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
  const requestedCountry = params.get("country");
  const country = requestedCountry && validCountryCode(requestedCountry) ?
    requestedCountry : preferredCountry(typeof navigator !== "undefined" ? navigator.languages : []);
  const service = params.get("service") || "Plumbing";
  const town = params.get("town") || "";
  const [results, setResults] = useState<WorkerProfile[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(WORKER_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchRequest = useRef(0);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  const change = (name: string, value: string) => {
    if (name === "town" || name === "country") {
      locationRequest.current += 1; // Do not overwrite manual edits with a late GPS response.
      setLocating(false);
      setLocationMessage("");
    }
    setParams(current => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value); else next.delete(name);
      return next;
    }, { replace: true });
  };
  useEffect(() => {
    const request = ++searchRequest.current;
    setBusy(true); setError(""); setResults([]); setHasMore(false); setNextOffset(WORKER_PAGE_SIZE);
    listWorkers({ country, service, town }).then(page => {
      if (searchRequest.current !== request) return;
      setResults(page.workers); setHasMore(page.hasMore);
    }).catch(e => {
      if (searchRequest.current === request) setError(e instanceof Error ? e.message : "Could not load workers.");
    }).finally(() => { if (searchRequest.current === request) setBusy(false); });
    return () => { searchRequest.current++; };
  }, [country, service, town, refresh]);
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const request = searchRequest.current;
    setLoadingMore(true);
    try {
      const page = await listWorkers({ country, service, town }, nextOffset);
      if (request !== searchRequest.current) return;
      setResults(previous => [...previous, ...page.workers]);
      setNextOffset(current => current + WORKER_PAGE_SIZE);
      setHasMore(page.hasMore);
    } catch (e) {
      if (request === searchRequest.current) setError(e instanceof Error ? e.message : "Could not load more workers.");
    } finally { setLoadingMore(false); }
  };
  const locate = async () => {
    const request = ++locationRequest.current;
    setLocating(true); setLocationMessage("");
    try {
      const detected = await detectCurrentArea();
      if (locationRequest.current !== request) return;
      setParams(current => {
        const next = new URLSearchParams(current);
        next.set("country", detected.country);
        next.set("town", detected.town);
        return next;
      }, { replace: true });
      setLocationMessage("Your approximate area: " + detected.town +
        (detected.locality ? " (near " + detected.locality + ")" : "") +
        ". Search results now use this town. You can adjust it manually.");
    } catch (e) {
      if (locationRequest.current === request)
        setLocationMessage(e instanceof Error ? e.message : "Automatic location failed. Enter your town manually.");
    } finally {
      if (locationRequest.current === request) setLocating(false);
    }
  };
  const clearTown = () => change("town", "");
  const countryName = countryLabel(country);
  return <div className="screen worker-page">
    <header className="worker-header">
      <div><p className="worker-kicker">LOCAL SERVICES</p><h1 className="large-title">Find a worker</h1><p>Discover service providers across the world. Choose your country and town, or use optional location detection. No account needed to browse.</p></div>
      <Link className="btn btn-soft" to="/workers/account">I'm a worker</Link>
    </header>
    <section className="worker-panel" aria-label="Search workers">
      <div className="worker-fields">
        <label>Service needed
          <select value={service} onChange={e => change("service", e.target.value)}>{SERVICES.map(x => <option key={x}>{x}</option>)}</select>
        </label>
        <label>Country
          <select value={country} onChange={e => {
            locationRequest.current += 1; setLocating(false); setLocationMessage("");
            setParams(current => { const next = new URLSearchParams(current); next.set("country", e.target.value); next.delete("town"); return next; }, { replace: true });
          }}>{COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}</select>
        </label>
        <label>Town or area
          <input value={town} maxLength={100} placeholder="Enter city or town" onChange={e => change("town", e.target.value)} />
        </label>
      </div>
      <div className="worker-location-actions">
        <button type="button" className="worker-location" onClick={locate} disabled={locating} aria-busy={locating}><LocateFixed size={17} /> {locating ? "Detecting your town…" : "Use my approximate location"}</button>
        {town && <button type="button" className="worker-location-clear" onClick={clearTown}>Search all of {countryName}</button>}
      </div>
      <p className="worker-muted worker-location-note">Location is optional. If you allow it, your approximate coordinates go to <a href="https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free" target="_blank" rel="noopener noreferrer">BigDataCloud</a> to find your town (it uses device and network location signals). If unavailable, we may ask <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Troot Window does not save your GPS coordinates. You can always enter your town yourself.</p>
      {locationMessage && <p role="status" className="worker-message">{locationMessage}</p>}
    </section>
    <div className="worker-results-head"><h2><Search size={19} /> Available listings</h2><small>{town ? "Searching " + town + ", " + countryName + " · " : "Searching " + countryName + " · "}Matches by service area, not GPS distance</small></div>
    {busy ? <div className="state" role="status" aria-busy="true">Loading worker profiles…</div> :
      error ? <div className="state" role="alert"><h3>Couldn't load workers</h3><p>{error}</p><button className="btn btn-primary" onClick={() => setRefresh(n => n+1)}>Try again</button></div> :
      results.length ? <><div className="worker-list">{results.map(worker => <WorkerCard key={worker.id} worker={worker} />)}</div>{hasMore && <div className="worker-more"><button type="button" className="btn btn-soft" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading more workers…" : "Load more workers"}</button></div>}</> :
      <div className="state worker-empty"><h3>No matching workers yet</h3><p>{town ? "No public " + service.toLowerCase() + " profiles currently serve " + town + ". Try searching the whole country or another area." : "No public " + service.toLowerCase() + " profiles currently match in " + countryName + ". Try another service."} Workers must register and publish their own listings before they appear.</p>{town && <button type="button" className="btn btn-primary" onClick={clearTown}>Show workers throughout {countryName}</button>}<Link to="/workers/account" className="btn btn-soft">Register as a worker</Link></div>}
  </div>;
}
export function WorkerDetail() {
  const { id = "" } = useParams();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true; setBusy(true); setError(""); setWorker(null);
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
        <div className="worker-detail-head"><WorkerPhoto worker={worker} /><div><h1>{worker.display_name}</h1><p><MapPin size={16} /> {worker.town}, {countryLabel(worker.country_code)}</p><p>{worker.availability}</p></div></div>
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

