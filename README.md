# Troot Window

Troot Window is a simple job marketplace designed around one principle: **finding work should not require an account first**.

## Current user experience
- Public job search and job details without login.
- Search by job, skill, employer or location.
- Filter by category and work type.
- Clear pay, requirements and employer verification labels.
- Direct WhatsApp, phone and email contact where supplied by an employer.
- Employers can post jobs with job details, requirements and contact methods.
- Bright, accessible neumorphic UI that works on mobile and desktop.
- Ads are reserved for clearly labelled, inline sponsor slots. No pop-ups, interstitials, forced redirects or ads over buttons/forms.

## Trust
A verification badge is informational, not a guarantee. Users should verify employers independently and never send passwords, OTPs or banking credentials.

## Architecture
The frontend is React + TypeScript + Vite + Capacitor. Job data currently falls back to bundled listings and locally posted listings. The next production step is connecting the same UI to a persistent ASP.NET Core API so public listings are shared across devices.

## Ads
Use an approved ad provider only after the core job experience works. Keep ads below the fold or between result groups, clearly marked as sponsored, and never place them over navigation, search, job details, contact actions, or forms.
