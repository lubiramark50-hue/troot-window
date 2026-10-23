import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

// Jobs are deliberately anonymous; worker auth cannot change public job flows.
export const supabase = createClient(url || "http://localhost", anonKey || "missing", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { "x-client-info": "troot-window-app" } },
});

// Separate session storage permits worker sign-in while visitors browse
// without creating an account. The anon/publishable key is public by design;
// the database migration enforces owner-only RLS for worker profile writes.
export const workerSupabase = createClient(url || "http://localhost", anonKey || "missing", {
  auth: {
    storageKey: "troot-worker-session",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { headers: { "x-client-info": "troot-window-worker-auth" } },
});

