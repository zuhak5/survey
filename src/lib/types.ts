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
