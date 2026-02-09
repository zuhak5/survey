import type { LatLng } from "@/lib/pricing";

export type RouteCluster = {
  cluster_id: string;
  start_bucket: string;
  end_bucket: string;
  time_bucket: number | null;
  day_of_week: number | null;
  vehicle_type: string | null;
  centroid_start_lat: number;
  centroid_start_lng: number;
  centroid_end_lat: number;
  centroid_end_lng: number;
  median_price: number;
  iqr_price: number;
  price_variance: number | null;
  sample_count: number;
  confidence_score: number;
  first_sample_at: string | null;
  last_updated: string | null;
};

export type SuggestPriceResponse = {
  suggested_price: number | null;
  price_range: [number, number] | null;
  median: number | null;
  count: number;
  confidence: number;
  last_updated: string | null;
  cluster_id: string | null;
  start: LatLng;
  end: LatLng;
};

export type GovernoratePricing = {
  governorate_code: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  base_fare_iqd: number;
  time_fare_iqd_per_min: number;
  distance_fare_iqd_per_km: number;
  minimum_fare_iqd: number;
  surge_multiplier: number;
  surge_cap: number;
  rounding_step_iqd: number;
  notes: string | null;
  submission_count: number;
  baseline_count: number;
  jam_count: number;
  night_count: number;
  fit_sample_count: number;
  fit_mae_iqd: number | null;
  fit_rmse_iqd: number | null;
  last_submission_at: string | null;
  updated_by: string | null;
  updated_at: string;
};
