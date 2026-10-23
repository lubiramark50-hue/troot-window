import { COUNTRIES } from "./workers";

export type ResolvedArea = { country: string; town: string; locality: string; provider: "BigDataCloud" | "OpenStreetMap" };

const supported = new Set<string>(COUNTRIES.map(c => c.code));
const requests = { timeout: 9000 };

function name(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").replace(/\s+(?:capital city|city|district|municipality|county)$/i, "").trim() : "";
}

function allowed(country: string, town: string): boolean {
  return supported.has(country) && town.length >= 2 && town.length <= 100;
}

export function parseBigDataCloud(value: unknown): ResolvedArea | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const country = String(data.countryCode || "").toUpperCase();
  const town = name(data.city) || name(data.locality);
  if (!allowed(country, town)) return null;
  const locality = name(data.locality);
  return { country, town, locality: locality.toLowerCase() === town.toLowerCase() ? "" : locality, provider: "BigDataCloud" };
}

export function parseOpenStreetMap(value: unknown): ResolvedArea | null {
  if (!value || typeof value !== "object") return null;
  const address = (value as Record<string, unknown>).address;
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, unknown>;
  const country = String(a.country_code || "").toUpperCase();
  const town = name(a.city) || name(a.town) || name(a.municipality) || name(a.village) ||
    name(a.county) || name(a.state_district) || name(a.city_district);
  if (!allowed(country, town)) return null;
  const locality = name(a.suburb) || name(a.neighbourhood) || name(a.city_district);
  return { country, town, locality: locality.toLowerCase() === town.toLowerCase() ? "" : locality, provider: "OpenStreetMap" };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requests.timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Geocoding service unavailable.");
    return await response.json();
  } finally { clearTimeout(timer); }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ResolvedArea> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    throw new Error("Unable to read valid device coordinates.");
  // Coarsen to ~100 m before any third-party request; no coordinates are saved.
  const lat = latitude.toFixed(3), lon = longitude.toFixed(3);
  try {
    const url = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
      encodeURIComponent(lat) + "&longitude=" + encodeURIComponent(lon) + "&localityLanguage=en";
    const resolved = parseBigDataCloud(await fetchJson(url));
    if (resolved) return resolved;
  } catch { /* Try alternate lookup provider, then offer manual entry. */ }
  try {
    // Fallback is limited to explicit button presses; do not use for live autocomplete.
    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=" +
      encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon);
    const resolved = parseOpenStreetMap(await fetchJson(url));
    if (resolved) return resolved;
  } catch { /* Manual search remains available even when geocoding is offline. */ }
  throw new Error("Could not identify your town. You can still choose a country and enter your town manually.");
}

export function geolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1: return "Location permission is blocked. Allow location for this site in your browser settings, or enter your town below.";
    case 2: return "Your device could not determine its location. Turn on Location Services or enter your town manually.";
    case 3: return "Location timed out. Check that GPS and Location Services are enabled, then try again or enter your town.";
    default: return "Your device location is unavailable. Enter your town manually.";
  }
}

export function getDevicePosition(): Promise<GeolocationPosition> {
  if (typeof window !== "undefined" && !window.isSecureContext)
    return Promise.reject(new Error("Automatic location requires HTTPS. You can enter your town manually."));
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return Promise.reject(new Error("This browser does not support automatic location. Enter your town manually."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (error: GeolocationPositionError) => reject(new Error(geolocationError(error))),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 20000 });
  });
}

export async function detectCurrentArea(): Promise<ResolvedArea> {
  const position = await getDevicePosition();
  return reverseGeocode(position.coords.latitude, position.coords.longitude);
}
