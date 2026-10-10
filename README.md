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

## Job sources
Listings come from two places. Employers' own applicant-tracking feeds (Greenhouse, Lever, Ashby,
Workable, SmartRecruiters) are first-party data and are shown as **verified employers**; the list of
approved companies lives in `frontend/scripts/approved-companies.json` and must pass
`npm run verify:sources`. Public remote feeds (Remotive, Jobicy, Himalayas, Arbeitnow) are capped per
feed, attributed in the app and never verified.

The sync files each title onto one of the board's six categories (`frontend/scripts/job-categories.mjs`);
`npm run test:categories` checks that mapping on real titles, offline, and runs in the workflow before
anything is written to the board.

Run it: `npm run sync:jobs:dry` to fetch and normalise only, `npm run sync:jobs` to also write
`ingest.sql`. The `Sync job sources` workflow does this every 6 hours and applies it over
`SUPABASE_DB_URL`. Before syncing it applies `frontend/supabase/schema.sql` whenever the provenance
columns are missing, so one run brings a fresh project up; run `Apply Supabase schema` alone when
`schema.sql` changes. The sync never uses the anon key: `ingest_external_jobs()` is executable only by
the database owner, and the insert trigger clears any provenance a public submission tries to claim.

Apply the schema before deploying the frontend. The app falls back to the previous column list if it
meets a database without the provenance columns, so a deploy that lands first will not break the board.

## Android build
`npm run cap:sync` builds, adds the Android platform if missing, generates icons and splash from `assets/` (via `@capacitor/assets`), then syncs.
Edit `assets/*.svg`; `node scripts/build-icons.mjs` renders the PNGs (they are generated, not committed).

CI secrets needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus the existing Android signing secrets.

## Legacy
`backend/` (ASP.NET Core + SQL Server) is no longer used by the app. Remove it when you are ready.

## Ads
Only inline, clearly labelled sponsored slots. Never cover navigation, forms, contact buttons or job content; no pop-ups, forced redirects or autoplay audio.
