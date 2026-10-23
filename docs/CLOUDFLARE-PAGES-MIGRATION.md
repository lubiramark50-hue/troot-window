# TROOT Window migration: Netlify to Cloudflare Pages

## Non-negotiable protections

Production domain remains **https://trootwindow.rentpay.site/**; Google-indexed paths, canonical URL, title/metadata, robots.txt and sitemap.xml are unchanged. Continue using Supabase project `wftjesokdmjzixshjcwf` and existing public API contracts; the legacy `backend/` is NOT active. Android Capacitor OTA and public job feeds must continue to work.

The new Pages preview must not be indexed: the host-specific `X-Robots-Tag: noindex` headers on `troot-window.pages.dev` and its versioned preview hosts protect against duplicate indexing. **Never** add a global `noindex` header, remove canonical URLs, or redirect the public domain to a temporary address.

Cloudflare account `1aec604c2c2401940cd93136962a7ef5` currently **cannot see the DNS zone** `rentpay.site` (checked October 23, 2026). Do not change the site's existing nameservers or DNS until the authoritative zone, record owners, CNAME/SSL, and rollback path have been verified.

## Cloudflare Pages build configuration

- Project: `troot-window` (preview: `https://troot-window.pages.dev`).
- Repository: `lubiramark50-hue/troot-window`.
- Deployment source: React 19 / Vite app in `frontend`.
- Root directory: `frontend`.
- Build command: `npm ci && npm run build`.
- Output directory: `dist`.
- Node.js major: 22 (set `NODE_VERSION=22` if needed).
- Build environment: `VITE_SUPABASE_URL=https://wftjesokdmjzixshjcwf.supabase.co` and `VITE_SUPABASE_ANON_KEY` from the existing Supabase project, securely configured in Pages project settings (public anon/publishable key only, NEVER `service_role`).
- Migration branch: `migration/cloudflare-pages-20261023`. Keep Netlify `main` and its deployment untouched until verification.

## Gates before DNS cutover

1. Run the branch workflow `cloudflare-migration-ci.yml` and confirm tests/build pass.
2. Confirm Pages build deployment succeeds. Manually run `cloudflare-preview-smoke.yml` using its actual preview hostname, then run desktop and mobile browser checks.
3. Compare live Netlify and Cloudflare preview: root, `/workers`, `/jobs`, job details, `/workers/account`, image/asset files, favicon, robots/sitemap, canonical/OG metadata, CSP/HSTS headers, cache/version/OTA behavior. Check anonymous worker/job browsing and post/auth flows with non-production test accounts. Do not claim pass without evidence.
4. Check DNS ownership and existing record(s). Confirm the Cloudflare Pages custom domain can validate SSL for `trootwindow.rentpay.site` while leaving current Netlify route functional.
5. Capture a rollback snapshot of the original DNS record, Netlify deployment ID and published SEO metadata, and ensure the previous Netlify endpoint stays usable.
6. **Only after all green** route the SAME public hostname to Cloudflare; do not use a 301 redirect to `pages.dev`.
7. Monitor TLS, redirects, indexed URLs, Search Console, RLS/worker accounts, subscriptions, mobile OTA and edge caches after cutover.
8. Keep Netlify available for rollback until stable; do not delete account, site, deploys, DNS, or secrets prematurely.

Google controls rankings and indexing; maintaining the same public URL and 200/canonical/robots signals minimizes risk but cannot guarantee unchanged search ranking.
