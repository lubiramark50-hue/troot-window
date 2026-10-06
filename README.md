# Troot Window

Job marketplace app. React 19, TypeScript, Vite, Capacitor (Android), Supabase.
Workers browse without an account. Employer submissions go live immediately, guarded by per-network rate limits, duplicate blocking and a 30-day expiry.

## Setup
1. Supabase Dashboard > SQL Editor: run `frontend/supabase/schema.sql` once.
2. `cd frontend && cp .env.example .env` and paste the anon key (Project Settings > API).
3. `npm install && npm run dev`

## Security model
- App ships only the anon key. RLS plus column grants decide everything (see schema.sql).
- Public can read published jobs, submit jobs (published server-side immediately), and report published jobs. Nothing else.
- Status, verification and publish date are server-controlled by triggers. Clients cannot set them.
- Per-network rate limits run in the database on a hashed IP. Raw IPs are never stored.
- Moderate in the Supabase dashboard. Never put the `service_role` key in the app or CI.

## Android build
`npm run cap:sync` builds, adds the Android platform if missing, generates icons and splash from `assets/` (via `@capacitor/assets`), then syncs.
Edit `assets/*.svg`; `node scripts/build-icons.mjs` renders the PNGs (they are generated, not committed).

CI secrets needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus the existing Android signing secrets.

## Legacy
`backend/` (ASP.NET Core + SQL Server) is no longer used by the app. Remove it when you are ready.

## Ads
Only inline, clearly labelled sponsored slots. Never cover navigation, forms, contact buttons or job content; no pop-ups, forced redirects or autoplay audio.
