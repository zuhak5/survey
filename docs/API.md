# API Contract (MVP + ML Stub)

Base URL (local): `http://localhost:3000`

## `POST /api/submit-route`

Submit one route + price observation (anonymous, no signup required).

### Request JSON

```json
{
  "client_request_id": "3a07b0e6-80d2-4a1c-9b38-1d3e1d4d9f4a",
  "start": { "lat": 33.3128, "lng": 44.3615 },
  "end": { "lat": 33.3152, "lng": 44.3661 },
  "start_label": "المنصور، بغداد",
  "end_label": "الكرادة، بغداد",
  "time_of_day": "day",
  "traffic_level": 2,
  "eta_s": 900,
  "price": 9000
}
```

`client_request_id` is required and enables idempotent submit behavior.

### Response 200

```json
{
  "status": "ok",
  "submission_id": "6ec6de7b-3c7f-43a5-a6f7-f46365f00542"
}
```

## `GET /api/suggest-price`

Query aggregated pricing recommendation from clustered submissions.

### Query

- `start=lat,lng` (required)
- `end=lat,lng` (required)
- `vehicle_type` (optional)
- `time_bucket` (optional, -1..23)
- `day_of_week` (optional, -1..6)

Notes:
- `-1` means "any" bucket (used by the anonymous day/night flow which aggregates across weekdays).

### Response 200

```json
{
  "suggested_price": 8500,
  "price_range": [8000, 9000],
  "median": 8400,
  "count": 27,
  "confidence": 0.78,
  "last_updated": "2026-02-07T23:00:00Z",
  "cluster_id": "2fb0c063-c47f-4521-b39e-9d8b2c0ab65a",
  "start": { "lat": 33.3128, "lng": 44.3615 },
  "end": { "lat": 33.3152, "lng": 44.3661 }
}
```

When no cluster exists, endpoint returns a distance-based fallback with `count = 0`.

## `GET /api/predict-price`

ML-ready prediction endpoint. For MVP it returns the suggest-price result plus stub metadata.

### Response 200

```json
{
  "suggested_price": 8500,
  "price_range": [8000, 9000],
  "median": 8400,
  "count": 27,
  "confidence": 0.78,
  "last_updated": "2026-02-07T23:00:00Z",
  "cluster_id": "2fb0c063-c47f-4521-b39e-9d8b2c0ab65a",
  "start": { "lat": 33.3128, "lng": 44.3615 },
  "end": { "lat": 33.3152, "lng": 44.3661 },
  "model_version": null,
  "is_stub": true
}
```

## Admin APIs

All admin endpoints require an authenticated user that exists in `public.admin_users`.

- `GET /api/admin/clusters` - filtered cluster table data for dashboard.
- `GET /api/admin/export-csv` - CSV export of filtered cluster rows.
- `POST /api/admin/run-aggregation` - on-demand aggregation job execution.
- `POST /api/admin/export-training` - export feature store data to Supabase Storage bucket `training-exports`.

## Cron API

- `GET /api/cron/aggregate`
  - Protected by `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`.
  - Executes `refresh_route_clusters` and `refresh_feature_store`.
