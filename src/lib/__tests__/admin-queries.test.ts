import { clustersToCsv } from "@/lib/admin-queries";
import type { RouteCluster } from "@/lib/types";

describe("admin cluster csv", () => {
  it("serializes rows with headers and escaped fields", () => {
    const rows: RouteCluster[] = [
      {
        cluster_id: "abc-123",
        start_bucket: "1:2",
        end_bucket: "3:4",
        time_bucket: 9,
        day_of_week: 1,
        vehicle_type: 'sedan "vip"',
        centroid_start_lat: 33.31,
        centroid_start_lng: 44.36,
        centroid_end_lat: 33.32,
        centroid_end_lng: 44.37,
        median_price: 8500,
        iqr_price: 1000,
        price_variance: 250000,
        sample_count: 18,
        confidence_score: 0.76,
        first_sample_at: "2026-02-07T00:00:00.000Z",
        last_updated: "2026-02-07T23:00:00.000Z",
      },
    ];

    const csv = clustersToCsv(rows);
    expect(csv).toContain("cluster_id,start_bucket,end_bucket");
    expect(csv).toContain('"abc-123"');
    expect(csv).toContain('"sedan ""vip"""');
  });
});
