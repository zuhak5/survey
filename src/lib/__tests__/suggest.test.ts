import { clusterToSuggestResponse, fallbackSuggestResponse } from "@/lib/suggest";
import type { RouteCluster } from "@/lib/types";

describe("suggest helpers", () => {
  it("returns fallback suggestions when no cluster exists", () => {
    const response = fallbackSuggestResponse(
      { lat: 33.3128, lng: 44.3615 },
      { lat: 33.3152, lng: 44.3661 },
    );

    expect(response.suggested_price).toBeGreaterThan(0);
    expect(response.count).toBe(0);
    expect(response.cluster_id).toBeNull();
    expect(response.price_range?.length).toBe(2);
  });

  it("maps cluster rows into suggest API shape", () => {
    const cluster: RouteCluster = {
      cluster_id: "test-cluster",
      start_bucket: "1:1",
      end_bucket: "2:2",
      time_bucket: 12,
      day_of_week: 4,
      vehicle_type: "sedan",
      centroid_start_lat: 33.31,
      centroid_start_lng: 44.36,
      centroid_end_lat: 33.32,
      centroid_end_lng: 44.37,
      median_price: 8400,
      iqr_price: 1200,
      price_variance: 230000,
      sample_count: 33,
      confidence_score: 0.81,
      first_sample_at: "2026-02-01T00:00:00Z",
      last_updated: "2026-02-07T23:00:00Z",
    };

    const response = clusterToSuggestResponse(cluster, { lat: 33.31, lng: 44.36 }, { lat: 33.32, lng: 44.37 });

    expect(response.suggested_price).toBe(8400);
    expect(response.count).toBe(33);
    expect(response.cluster_id).toBe("test-cluster");
    expect(response.price_range).toEqual([7800, 9000]);
  });
});
