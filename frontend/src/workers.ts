import { supabase, workerSupabase } from "./supabase";

// Full ISO 3166-1 alpha-2 country/territory codes (tzdb iso3166.tab, 2025).
// Names are rendered using Intl.DisplayNames so the list stays consistent.
export const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
export const COUNTRIES = COUNTRY_CODES
  .map(code => ({ code, label: countryNames.of(code) || code }))
  .sort((a, b) => a.label.localeCompare(b.label, "en"));
const codes = new Set(COUNTRY_CODES);
const nameByCode = new Map(COUNTRIES.map(c => [c.code, c.label]));
export function validCountryCode(code: string): boolean { return codes.has(code); }
export function countryLabel(code: string): string { return nameByCode.get(code) || code; }

// Browser language-region is a *hint*, not GPS. Never request location permission
// simply to pick a default search country; users can change it at any time.
export function preferredCountry(languages: readonly string[] = []): string {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).region?.toUpperCase();
      if (region && validCountryCode(region)) return region;
    } catch { /* Ignore non-BCP-47 language tags. */ }
  }
  return "UG"; // Backwards-compatible default when the browser exposes no region.
}
export const SERVICES = [
  "Plumbing", "Electrical", "Mechanic", "Cleaning", "Building",
  "Carpentry", "Painting", "Welding", "Gardening", "Appliance repair",
  "Tailoring", "Moving", "Other",
] as const;
export type TravelMode = "mobile" | "fixed" | "both";
export type WorkerProfile = {
  id: string;
  display_name: string;
  services: string[];
  skills: string;
  country_code: string;
  town: string;
  service_areas: string[];
  travel_mode: TravelMode;
  availability: string;
  phone: string;
  whatsapp: string | null;
  description: string;
  work_examples: string;
  photo_url: string | null;
  experience_years: number | null;
  starting_price: string | null;
  updated_at: string;
};
export type OwnProfile = WorkerProfile & { user_id: string; is_active: boolean };
export type WorkerInput = Omit<OwnProfile, "id" | "updated_at">;
export type WorkerFilter = { service: string; country: string; town: string };

export function normalizeArea(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ").replace(/\s+(?:capital city|city|district|municipality|county)$/, "");
}
export function matchesWorker(worker: WorkerProfile, filter: WorkerFilter): boolean {
  if (worker.country_code !== filter.country || !worker.services.includes(filter.service)) return false;
  const requested = normalizeArea(filter.town);
  if (!requested) return true;
  if (normalizeArea(worker.town) === requested) return true;
  return worker.travel_mode !== "fixed" && worker.service_areas.some(a => normalizeArea(a) === requested);
}
export function rankWorkers(rows: WorkerProfile[], filter: WorkerFilter): WorkerProfile[] {
  const town = normalizeArea(filter.town);
  return rows.filter(w => matchesWorker(w, filter)).sort((a, b) => {
    const score = (w: WorkerProfile) => !town ? 0 : normalizeArea(w.town) === town ? 0 : 1;
    return score(a) - score(b) || a.display_name.localeCompare(b.display_name);
  });
}
export function contactPhone(value: string): string | null {
  const cleaned = value.replace(/[\s()-]/g, "");
  return /^\+[1-9][0-9]{6,14}$/.test(cleaned) ? cleaned : null;
}
export function whatsappUrl(value: string): string | null {
  const phone = contactPhone(value);
  return phone ? "https://wa.me/" + phone.substring(1) : null;
}
export function safeImageUrl(value: string | null): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch { return; }
}
const publicFields = "id,display_name,services,skills,country_code,town,service_areas,travel_mode,availability,phone,whatsapp,description,work_examples,photo_url,experience_years,starting_price,updated_at";
export const WORKER_PAGE_SIZE = 24;
export type WorkerPage = { workers: WorkerProfile[]; hasMore: boolean };
export async function listWorkers(filter: WorkerFilter, offset = 0): Promise<WorkerPage> {
  if (!validCountryCode(filter.country)) return { workers: [], hasMore: false };
  // Server-side exact town/service-area matching prevents truncating an entire
  // country at 200 people before applying town filters in the browser.
  const { data, error } = await supabase.rpc("search_public_workers", {
    p_country: filter.country, p_service: filter.service, p_town: filter.town,
    p_offset: offset, p_limit: WORKER_PAGE_SIZE + 1,
  });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as WorkerProfile[];
  return { workers: all.slice(0, WORKER_PAGE_SIZE), hasMore: all.length > WORKER_PAGE_SIZE };
}
export async function getWorker(id: string): Promise<WorkerProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from("worker_directory")
    .select(publicFields).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as WorkerProfile | null;
}
export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const { data, error } = await workerSupabase.from("worker_profiles")
    .select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as OwnProfile | null;
}
export async function saveOwnProfile(profile: WorkerInput): Promise<void> {
  const { error } = await workerSupabase.from("worker_profiles").upsert(profile, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

