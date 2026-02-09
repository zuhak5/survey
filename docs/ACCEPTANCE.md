# Acceptance Proof (Local)

Date: 2026-02-08

## Commands run

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Results

- `npm run lint`: passed
- `npm run test`: passed (3 suites, 8 tests)
- `npm run build`: passed (all routes compiled)
- `npm run test:e2e`: passed (driver MVP flow end-to-end)

## Verified behaviors

- Survey flow submits successfully through UI.
- Suggest-price endpoint returns a non-null `suggested_price`.
- Admin endpoints and cron route compile and are reachable by route map.
- Migration files and RLS test script are present for Supabase deployment validation.

# Acceptance Proof (Production Smoke)

Date: 2026-02-09

## Verified behaviors (prod)

- Public APIs:
  - `GET /api/suggest-price` returns 200 with a numeric `suggested_price`.
  - `POST /api/submit-route` returns 200 and creates a row in `public.submissions`.
- Admin:
  - Admin auth via Supabase email/password succeeds and `rpc('is_admin') = true`.
  - `GET /api/admin/clusters` returns 200.
  - `POST /api/admin/run-aggregation` returns 200 and completes successfully.
