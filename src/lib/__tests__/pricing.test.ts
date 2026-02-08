import {
  bucketKey,
  computeConfidenceScore,
  derivePresetPrices,
  haversineDistanceMeters,
  neighboringBucketKeys,
  normalizeVariance,
  suggestedPriceRange,
} from "@/lib/pricing";

describe("pricing utilities", () => {
  it("computes haversine distance in meters", () => {
    const distance = haversineDistanceMeters(
      { lat: 33.3128, lng: 44.3615 },
      { lat: 33.3152, lng: 44.3661 },
    );

    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(700);
  });

  it("creates deterministic bucket keys and neighbors", () => {
    const key = bucketKey({ lat: 33.3152, lng: 44.3661 });
    expect(key).toMatch(/^-?\d+:-?\d+$/);

    const neighbors = neighboringBucketKeys({ lat: 33.3152, lng: 44.3661 });
    expect(neighbors).toHaveLength(9);
    expect(neighbors).toContain(key);
  });

  it("derives three preset prices with anchor in center", () => {
    const [low, mid, high] = derivePresetPrices(5300);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    expect(mid % 500).toBe(0);
  });

  it("computes confidence score in 0..1 and decreases with variance", () => {
    const lowVarianceScore = computeConfidenceScore(40, 200_000, 9000);
    const highVarianceScore = computeConfidenceScore(40, 90_000_000, 9000);

    expect(lowVarianceScore).toBeGreaterThanOrEqual(0);
    expect(lowVarianceScore).toBeLessThanOrEqual(1);
    expect(highVarianceScore).toBeLessThan(lowVarianceScore);
  });

  it("normalizes variance and suggested range safely", () => {
    expect(normalizeVariance(0, 8000)).toBe(0);
    expect(normalizeVariance(999_999_999, 1)).toBe(1);
    expect(suggestedPriceRange(8500, 2000)).toEqual([7500, 9500]);
  });
});
