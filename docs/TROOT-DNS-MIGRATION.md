# TROOT: DNS migration controls

TROOT is deployed at https://troot-window.pages.dev while its indexed canonical remains https://trootwindow.rentpay.site. The Cloudflare Pages custom domain is associated but its validation is pending.

## One scoped permission, no registrar transfer

The domain is registered with Spaceship but uses Cloudflare authoritative DNS (curt.ns.cloudflare.com and riya.ns.cloudflare.com). Sign in to the Cloudflare **account that manages rentpay.site**, create a zone-limited API token with **Zone: Zone Read** and **Zone: DNS Edit**, restricted to **rentpay.site only**.

Save that token as GitHub repository Actions secret CLOUDFLARE_RENTPAY_DNS_TOKEN. Never commit or paste the token into code/chat.

Open https://github.com/lubiramark50-hue/troot-window/actions/workflows/troot-dns-cutover.yml

- First run `inspect` with blank confirmation. It checks zone authority, the exact existing CNAME, public HTTPS, canonical URLs and staging-only noindex; it makes no changes.
- Only after verifying readiness of Cloudflare custom-domain certificate and rollback, run `cutover` with confirmation `SWITCH_TROOT_TO_CLOUDFLARE`. It updates exactly trootwindow.rentpay.site, from troot-window.netlify.app to troot-window.pages.dev, as DNS only; no nameserver changes.
- If the public site fails TLS, job, login, worker, sitemap, SEO, or Android checks after cutover, run `rollback` with confirmation `RESTORE_TROOT_TO_NETLIFY`. Netlify must remain live until validated.

Do not change other DNS records or nameservers. Ensure Cloudflare Pages custom-domain validation, TLS, production security headers, jobs/workers, Supabase connection, favicon, robots, sitemap, canonical tags and mobile OTA are checked immediately after cutover. DNS propagation and certificate readiness can take time; no guarantee of zero downtime or unchanged search ranking.
