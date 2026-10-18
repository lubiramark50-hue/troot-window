# Troot Window admin review setup

The public job-posting form intentionally creates `pending_review` rows. The `/admin` route is not linked in public navigation and uses Supabase Auth; Row Level Security is the real security boundary.

## Provision the first administrator

1. In Supabase Dashboard → Authentication → Users, create or select the project owner's account.
2. Edit that user's **App Metadata** (not User Metadata) and set `role` to `admin`, for example `{ "role": "admin" }`.
3. Sign out and sign back in at `https://trootwindow.rentpay.site/admin` (or the review preview's `/admin` route) so the refreshed JWT contains the claim.
4. Approve a listing only after checking its title, employer, location, description, requirements and contact information. Approval does not mark the employer as verified.

Do not put a service-role key in the frontend. The SQL policies permit only a JWT with server-managed `app_metadata.role = admin` to read pending listings or update their status.
