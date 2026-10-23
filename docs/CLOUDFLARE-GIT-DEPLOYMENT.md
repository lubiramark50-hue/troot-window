# Cloudflare Pages Git deployment checkpoint

Created a separate Cloudflare Pages project named `troot-window` in account `1aec604c2c2401940cd93136962a7ef5` on 2026-10-23.

The Cloudflare project's Git production branch is **`migration/cloudflare-pages-20261023`**, deliberately not the Netlify deployment branch `main`. The project build root is `frontend`, build command is `npm ci && npm run build`, and output folder is `dist`. The project has TROOT's existing public Supabase frontend environment configuration. No server-side service-role key is supplied to Vite.

This repository update triggers the first Pages Git build. The Pages host is for staging and must send `X-Robots-Tag: noindex` so Google indexing remains with `https://trootwindow.rentpay.site/`. The canonical public domain is NOT yet migrated. This is not proof of production readiness.

Do not switch DNS or delete the Netlify site until HTTPS preview checks, Supabase workflows, deep links, security headers, SEO, domain ownership, TLS, and rollback have been verified. The connected account now lists a pending `rentpay.site` zone on rob/tara, but not the authoritative curt/riya zone. Changing records in that pending zone does not change live DNS.

## Release identity and continuous deployment

Pages' Vite build stamps `dist/version.json` and the compiled application's build ID
from `CF_PAGES_COMMIT_SHA`. It does not modify the Android `public/version.json` or
OTA manifest. Without Cloudflare build metadata, the existing GitHub/Netlify build
version behavior is preserved. The deployed smoke/browser workflows wait for the
exact commit being tested, so a previous healthy deployment cannot mask a failed
new build.

Migration workflows also support `main` for the eventual cutover. Until that
cutover, run manual checks with the migration branch selected. Do not point Pages
at main while it lacks these changes, and do not merge PR 21 while DNS/TLS gates
remain unmet. After approved cutover: merge the tested branch, move Pages' Git
production branch to main, wait for and verify that exact merge commit, and retain
Netlify as the rollback target. Its workflow may keep the fallback current; it
must not control the public hostname after the DNS change. Do not delete Netlify
or remove credentials while rollback is required.

## URL and metadata safety

The migration preserves the current public homepage's title, description and
Open Graph/Twitter text, as well as canonical/OG URLs, robots and sitemap. Explicit
rewrites retain supported job/worker/account/saved/post/safety/legal routes and
trailing-slash forms. A root `404.html` prevents Pages' implicit SPA fallback from
turning missing assets or unknown paths into HTTP 200. The public index document
has no global noindex directive; temporary Pages hosts remain host-scoped noindex.

Live browser smoke tests use fresh contexts and block every Supabase mutation,
except the read-only worker-search RPC. They verify actual job reads/details,
saved jobs in local browser storage, search reload, worker browsing, account
forms and responsive layouts. Separate isolated regression suites cover worker
signup/session/edit/pause/logout and accepted/rejected job submissions using
fixtures; they do not certify real inbox delivery or real authenticated writes.
