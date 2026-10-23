# Troot Window design cleanup specification

Repository: https://github.com/lubiramark50-hue/troot-window

Production: https://trootwindow.rentpay.site/

Baseline: production version 16, commit 640c64d6901133dd99dfce5bcf2811cefb004b33, confirmed October 23, 2026. The domain returns HTTP 200 through Netlify. Visual browser inspection is still required; source findings below are not claims of completed browser testing.

## Research

InterfaceKit's September 2026 update identifies interchangeable copy, decorative effects substituting for hierarchy, repetitive cards, inconsistent screens, and missing interaction states as useful audit criteria. No single font, color, or gradient establishes AI authorship.
https://blog.interfacekit.io/what-makes-a-website-look-ai-generated

DesignArena's January–October 2026 analysis shows changing aesthetic preferences. Recommendation: improve product specificity and usability rather than replace the existing palette with another trend.
https://www.designarena.ai/blog/when-does-taste-become-slop

## Source findings

- Feed hero: “THE FUTURE LOOKS BRIGHT”, “moves your life forward”, and “Real opportunities, genuine connections” convey little about how the board works.
- Hero decoration: stock career photo, orbit circles, rotated “Work. Grow. Belong.” label, gradients, and shadowed CTA dominate desktop space before jobs.
- Repetitive headings: several uppercase eyebrow labels repeat the opportunity theme without adding information.
- Category controls: emoji tiles and six repeated “Explore jobs” labels turn simple filtering into a promotional card grid. “Popular” is unsupported by usage data in this component.
- Sidebar: “YOUR WORKSPACE”, “Your next chapter starts here”, and sparkle-accompanied “Made for brighter futures” add generic application chrome and claims.
- Results: desktop cards, supplementary safety and employer cards, and category tiles compete for attention and limit room for long job titles.
- Search state: text search initializes from URL but input changes are not written back; history and shared filter URLs need verification and correction.
- Mobile: categories appear after results through CSS ordering while their DOM order remains before results. Align keyboard and visual order when changing the layout.
- Loading fallback is an empty busy container. Add a meaningful accessible loading label.

## Alternatives

1. Recommended: focused product cleanup. Retain the app shell, brand, palette, routes, and shared components; simplify the feed and supporting chrome. Best fit for preserving functionality and limiting regression risk.
2. Copy-only pass. Lower visual risk but leaves the excessive hero, competing cards, and mobile ordering problem.
3. Full layout replacement. Allows larger structural changes but increases regression risk across web and Capacitor. Unnecessary for this request.

## Proposed design

Preserve navy #0A234B, blue #1369E8, green #118A55 and existing light surfaces, logo, and employer marks. Keep the existing typography family and improve its hierarchy rather than rebrand.

Use a short introduction such as “Find your next job” and a factual supporting line: “Browse jobs, save listings, and contact employers. No account needed to browse.” Remove the decorative photo, orbit, rotated slogan, sparkle flourishes, and repeated promotional eyebrow text. Keep one clear employer posting link and concise safety guidance.

Make search and filters the main feed controls. Use compact text category buttons with explicit selected states and a clear-all action. Use “Categories” rather than “Popular categories”. Keep controls before results on both mobile and desktop, in the same DOM and visual order.

Use readable job rows with sufficient space for employer, title, location, work arrangement, pay, source, and save controls. Avoid nested decorative panels. Preserve verified provenance and attribution. Present safety guidance in a quieter supporting treatment with direct wording such as “Never pay to apply”. Do not invent testimonials, statistics, personalization, or verification guarantees.

Keep search text and filter URL state synchronized and test browser navigation. Preserve debounce, pagination, save behavior, links, form validation, reporting, and posting API contracts. Keep existing sanitization and database permissions unchanged.

## Verification and deployment

Before editing, run existing contract, category, source, and logo checks and a production build. After editing, repeat relevant checks and run the existing Playwright regression suite. Add meaningful coverage for URL search state and changed interactions where existing tests do not cover them.

Inspect production and the local result at phone, tablet, and desktop widths. Test keyboard focus, zoom, long titles, horizontal overflow, reduced motion, loading, empty, error/retry states, search/filter combinations, saved jobs, detail and application links, safety/legal navigation, posting validation, and mocked successful/rejected submissions. Do not create test listings in production.

Deploy through the existing GitHub Actions / Netlify workflow using stored secrets; do not print or retrieve secret values. Check workflow success and production version.json against the deployed commit, then repeat read-only production browser checks. Report API or credential limitations explicitly, and keep the previous production commit available for rollback. Deployment is already authorized by the user; this specification review concerns the design direction.

## Current status

Research and source inspection completed. Live HTTP and version metadata checked. Full live browser audit, implementation, final tests, and deployment remain pending. No application source or production changes made.
