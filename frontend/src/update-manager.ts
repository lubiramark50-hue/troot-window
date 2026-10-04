const BUILD_ID = import.meta.env.VITE_BUILD_SHA || "dev";
const VERSION_URL = new URL("version.json", document.baseURI).toString();
const CHECK_INTERVAL_MS = 30_000;
const STORAGE_KEY = "troot:last-reloaded-build";

interface RemoteVersion {
  version?: string;
  commit?: string;
  updatedAt?: string;
}

let timer: number | undefined;
let checking = false;

async function checkForUpdate(): Promise<void> {
  if (checking || document.visibilityState === "hidden") return;
  checking = true;

  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return;

    const remote = (await response.json()) as RemoteVersion;
    const remoteBuild = remote.commit || remote.version;

    if (!remoteBuild || remoteBuild === BUILD_ID || BUILD_ID === "dev") return;

    const lastReloaded = sessionStorage.getItem(STORAGE_KEY);
    if (lastReloaded === remoteBuild) return;

    sessionStorage.setItem(STORAGE_KEY, remoteBuild);
    window.location.reload();
  } catch {
    // Update checks are best-effort and must never break the application.
  } finally {
    checking = false;
  }
}

export function startAutomaticUpdates(): () => void {
  void checkForUpdate();
  timer = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    if (timer !== undefined) window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
