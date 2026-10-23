# Cloudflare Pages Git deployment checkpoint

Created a separate Cloudflare Pages project named `troot-window` in account `1aec604c2c2401940cd93136962a7ef5` on 2026-10-23.

The Cloudflare project's Git production branch is **`migration/cloudflare-pages-20261023`**, deliberately not the Netlify deployment branch `main`. The project build root is `frontend`, build command is `npm ci && npm run build`, and output folder is `dist`. The project has TROOT's existing public Supabase frontend environment configuration. No server-side service-role key is supplied to Vite.

This repository update triggers the first Pages Git build. The Pages host is for staging and must send `X-Robots-Tag: noindex` so Google indexing remains with `https://trootwindow.rentpay.site/`. The canonical public domain is NOT yet migrated. This is not proof of production readiness.

Do not switch DNS or delete the Netlify site until HTTPS preview checks, Supabase workflows, deep links, security headers, SEO, domain ownership, TLS, and rollback have been verified. The connected Cloudflare account currently does not list the `rentpay.site` DNS zone.
