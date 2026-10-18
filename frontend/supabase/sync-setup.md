# Scheduled job-source sync setup

The source-ingestion code and database function are ready, but the scheduled GitHub Action requires one private credential that is not currently configured in this repository.

## Add the database connection secret

1. Open the repository **Settings → Secrets and variables → Actions → New repository secret**.
2. Set the secret name to `SUPABASE_DB_URL`.
3. In Supabase Dashboard for project `wftjesokdmjzixshjcwf`, open **Project Settings → Database → Connection string** and choose a PostgreSQL URI that works from GitHub Actions. Use the Session Pooler URI if the direct host is not reachable from the runner.
4. Replace the password placeholder with the real database password and retain SSL (`sslmode=require`). Save the full URI only in the GitHub secret.
5. Never paste the URI, password, or service-role key into chat, a commit, an issue, or a log.
6. Run **Actions → Sync job sources → Run workflow** to verify ingestion, or wait for the next scheduled run.

The workflow checks that the secret exists before running. The database schema now contains the required source/expiry columns and ingestion/expiry functions. Without this secret, the action cannot connect to PostgreSQL and will not import listings.
