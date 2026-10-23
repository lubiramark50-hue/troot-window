import { supabase, workerSupabase } from "./supabase";

export const COUNTRIES = [
  { code: "UG", label: "Uganda" },
  { code: "KE", label: "Kenya" },
  { code: "TZ", label: "Tanzania" },
  { code: "RW", label: "Rwanda" },
] as const;
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
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
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
export async function listWorkers(filter: WorkerFilter): Promise<WorkerProfile[]> {
  const { data, error } = await supabase.from("worker_directory")
    .select(publicFields).eq("country_code", filter.country)
    .contains("services", [filter.service]).limit(200);
  if (error) throw new Error(error.message);
  return rankWorkers((data ?? []) as WorkerProfile[], filter);
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

