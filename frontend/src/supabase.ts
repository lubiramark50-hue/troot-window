import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

// The anon key is public by design. Security is enforced by Row Level Security
// and column grants in supabase/schema.sql. Never ship the service_role key.
export const supabase = createClient(url || "http://localhost", anonKey || "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { headers: { "x-client-info": "troot-window-app" } },
});
