const BUILD_ID = import.meta.env.VITE_BUILD_SHA || "dev";
const VERSION_URL = new URL("version.json", document.baseURI).toString();
const OTA_MANIFEST_URL = "https://raw.githubusercontent.com/lubiramark50-hue/troot-window/main/ota/latest.json";
const CHECK_INTERVAL_MS = 300_000;
const STORAGE_KEY = "troot:last-reloaded-build";

interface RemoteVersion { version?: string; commit?: string; updatedAt?: string; }
interface OtaManifest { versionCode?: number; version?: string; apkUrl?: string; sha256?: string; mandatory?: boolean; }
let timer: number | undefined;
let checking = false;
let otaPrompted = false;

function isNativeAndroid(): boolean {
  const cap = (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  return !!cap?.isNativePlatform?.() && cap.getPlatform?.() === "android";
}

async function offerAndroidOta(): Promise<void> {
  if (!isNativeAndroid() || otaPrompted) return;
  try {
    const response = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const ota = (await response.json()) as OtaManifest;
    if (!ota.apkUrl || !ota.versionCode || !ota.sha256) return;
    const seen = Number(localStorage.getItem("troot:ota-version") || "0");
    if (ota.versionCode <= seen) return;
    otaPrompted = true;
    const message = ota.mandatory ? "A required Troot Window update is available." : "A new Troot Window update is available.";
    if (ota.mandatory || window.confirm(`${message}\n\nUpdate now?`)) {
      localStorage.setItem("troot:ota-version", String(ota.versionCode));
      window.location.href = ota.apkUrl;
    } else {
      otaPrompted = false;
    }
  } catch { }
}

async function checkForUpdate(): Promise<void> {
  if (checking || document.visibilityState === "hidden") return;
  checking = true;
  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const remote = (await response.json()) as RemoteVersion;
    const remoteBuild = remote.commit || remote.version;
    if (!remoteBuild || remoteBuild === BUILD_ID || BUILD_ID === "dev") {
      await offerAndroidOta();
      return;
    }
    const lastReloaded = sessionStorage.getItem(STORAGE_KEY);
    if (lastReloaded === remoteBuild) return;
    sessionStorage.setItem(STORAGE_KEY, remoteBuild);
    window.location.reload();
  } catch { }
  finally { checking = false; }
}

export function startAutomaticUpdates(): () => void {
  void checkForUpdate();
  timer = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
  const onVisibilityChange = () => { if (document.visibilityState === "visible") void checkForUpdate(); };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    if (timer !== undefined) window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
