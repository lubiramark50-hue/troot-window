import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { jobsApi, type Job } from "../api";
import { useSaved } from "../ui";
import { ErrorState, JobRow, Skeletons } from "./Feed";

export default function Saved() {
  const { ids } = useSaved();
  const key = ids.join(",");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setError("");
    if (ids.length === 0) { setJobs([]); return; }
    jobsApi.getMany(ids).then((r) => live && setJobs(r)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  return (
    <div className="screen">
      <header className="home-head"><h1 className="large-title">Saved</h1></header>
      {error ? <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
        : jobs === null ? <Skeletons n={3} />
        : jobs.length === 0 ? <div className="state"><Bookmark size={34} /><h3>Nothing saved yet</h3><p>Tap the bookmark on any job to keep it here.</p></div>
        : <div className="list">{jobs.map((j) => <JobRow key={j.id} job={j} />)}</div>}
    </div>
  );
}
