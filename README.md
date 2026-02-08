# Driver Price Survey (Iraq)

Production-ready MVP for collecting driver-submitted route prices, clustering submissions nightly, and serving pricing suggestions + ML-stub predictions.

## Stack

- Frontend: Next.js 16 + TypeScript + Tailwind (Arabic-first UX)
- Maps: Google Maps JavaScript API (`@googlemaps/js-api-loader`)
- Backend/DB/Auth: Supabase (Postgres + Auth + Storage + RLS)
- Deployment: Vercel
- CI/CD: GitHub Actions (`lint + unit + build + e2e`)
- Testing: Jest + Playwright

## Implemented MVP

- `/` survey flow (anonymous): start pin -> end pin -> route shown (distance + ETA + names) -> day/night + traffic -> wheel price + custom -> submit
- `POST /api/submit-route`
- Nightly aggregation (`refresh_route_clusters`) + confidence score
- `GET /api/suggest-price`
- `/admin` protected dashboard (heatmap + table + filters + CSV export)
- RLS policies for admin access model (survey inserts are performed server-side)
- Vercel cron endpoint (`/api/cron/aggregate`)

## Implemented Phase-2 foundations

- `feature_store` table + nightly `refresh_feature_store`
- `training_exports` metadata + storage export endpoint
- `predictions_log`
- `GET /api/predict-price` stub response (`is_stub: true`, `model_version: null`)

## Repository Branches

- `main`: deployable production branch
- `dev`: integration/development branch

Create `dev` branch locally:

```bash
git branch dev
```

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://onhhfzzkjoqxfeotleqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_JS_KEY
CRON_SECRET=YOUR_CRON_SECRET

# Optional for local testing without live Supabase
NEXT_PUBLIC_DISABLE_MAPS=1
NEXT_PUBLIC_TEST_AUTH_BYPASS=1
TEST_AUTH_BYPASS_ENABLED=1
TEST_AUTH_BYPASS_DRIVER_ID=11111111-1111-4111-8111-111111111111
```

## Local Setup

```bash
npm ci
npm run dev
```

App: `http://localhost:3000`

## Database Setup (Supabase)

Apply migrations in order:

1. `supabase/migrations/202602080001_initial_schema.sql`
2. `supabase/migrations/202602080002_rls_policies.sql`
3. `supabase/migrations/202602080003_storage.sql`
4. `supabase/migrations/202602080012_anonymous_survey.sql`

If using Supabase CLI (recommended for repeatability):

```bash
# If linking works in your environment:
supabase link --project-ref onhhfzzkjoqxfeotleqo
supabase db push --include-all
```

If `supabase db push` fails to connect (common on networks without IPv6), use the IPv4 pooler DB URL directly:

```bash
supabase db push --include-all --db-url "postgresql://postgres.onhhfzzkjoqxfeotleqo:YOUR_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

## Aggregation Jobs

- On-demand (script): `npm run aggregate:run`
- On-demand (admin API): `POST /api/admin/run-aggregation`
- Scheduled: `GET /api/cron/aggregate` (protected by `CRON_SECRET`)
- Vercel cron schedule configured in `vercel.json` (`0 2 * * *`)

## API Endpoints

See `docs/API.md` for full contract and examples.
Local verification logs are documented in `docs/ACCEPTANCE.md`.

Core endpoints:

- `POST /api/submit-route`
- `GET /api/suggest-price`
- `GET /api/predict-price`
- `GET /api/admin/clusters`
- `GET /api/admin/export-csv`
- `POST /api/admin/run-aggregation`
- `POST /api/admin/export-training`

## Security (RLS)

- Admin (`app_metadata.role = "admin"`):
  - read/aggregate all data
  - write cluster/feature/training metadata
- Public survey flow:
  - `POST /api/submit-route` inserts using `SUPABASE_SERVICE_ROLE_KEY`
  - direct client inserts to `public.submissions` remain blocked by RLS
- Tests:
  - SQL RLS test script at `supabase/tests/rls.sql`

## Tests

```bash
npm run lint
npm run test
npm run test:e2e
```

Load smoke test (~100 concurrent submits/min):

```bash
npm run load:test
```

## Vercel Deployment

1. Import repo into Vercel.
2. Set all env vars from **Environment Variables** section.
3. Deploy from `main`.
4. Confirm cron exists (Project Settings -> Cron Jobs).
5. For `/admin`, ensure at least one Supabase Auth provider is enabled (Email OTP is simplest).

## Admin Access

Set admin claim in Supabase Auth:

```json
{
  "app_metadata": {
    "role": "admin"
  }
}
```

## Definition of Done Checklist

- [x] Survey flow with minimal taps and Arabic microcopy
- [x] Raw submissions schema + API
- [x] Cluster aggregation + confidence
- [x] Suggest-price + predict-price stub APIs
- [x] Admin heatmap/table + CSV export + filters
- [x] RLS policies
- [x] CI workflow + docs + tests

