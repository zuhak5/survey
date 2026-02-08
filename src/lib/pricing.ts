export type LatLng = { lat: number; lng: number };

export const GRID_SIZE_DEGREES = 0.0015;

const EARTH_RADIUS_M = 6_371_000;

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(start: LatLng, end: LatLng): number {
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}

export function bucketKey(point: LatLng, gridSize = GRID_SIZE_DEGREES): string {
  const latCell = Math.floor(point.lat / gridSize);
  const lngCell = Math.floor(point.lng / gridSize);
  return `${latCell}:${lngCell}`;
}

export function bucketKeyParts(key: string): { latCell: number; lngCell: number } {
  const [latCell, lngCell] = key.split(":").map(Number);
  return { latCell, lngCell };
}

export function neighboringBucketKeys(
  point: LatLng,
  gridSize = GRID_SIZE_DEGREES,
): string[] {
  const base = bucketKey(point, gridSize);
  const { latCell, lngCell } = bucketKeyParts(base);
  const keys: string[] = [];

  for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
    for (let lngOffset = -1; lngOffset <= 1; lngOffset += 1) {
      keys.push(`${latCell + latOffset}:${lngCell + lngOffset}`);
    }
  }

  return keys;
}

export function parseLatLng(value: string | null): LatLng | null {
  if (!value) {
    return null;
  }

  const [lat, lng] = value.split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

export function derivePresetPrices(distanceMeters: number): [number, number, number] {
  const distanceKm = distanceMeters / 1000;
  const baseline = Math.max(4_000, Math.round((distanceKm * 1_500) / 500) * 500);
  const low = Math.max(1_000, baseline - 1_000);
  const high = baseline + 1_000;
  return [low, baseline, high];
}

export function normalizeVariance(variance: number, medianPrice: number): number {
  if (!Number.isFinite(variance) || variance <= 0) {
    return 0;
  }
  const denominator = Math.max(1, medianPrice) ** 2;
  return Math.min(1, variance / denominator);
}

export function computeConfidenceScore(
  sampleCount: number,
  variance: number,
  medianPrice: number,
): number {
  const countComponent = Math.min(1, Math.log10(sampleCount + 1) / 3);
  const normalizedVariance = normalizeVariance(variance, medianPrice);
  const score = countComponent * (1 - normalizedVariance);
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}

export function suggestedPriceRange(median: number, iqr: number): [number, number] {
  const spread = Math.max(500, Math.round(iqr / 2));
  const lower = Math.max(500, median - spread);
  const upper = median + spread;
  return [lower, upper];
}

export function currentBaghdadTemporalBuckets(date = new Date()): {
  time_bucket: number;
  day_of_week: number;
} {
  const local = new Date(
    date.toLocaleString("en-US", {
      timeZone: "Asia/Baghdad",
      hour12: false,
    }),
  );

  return {
    time_bucket: local.getHours(),
    day_of_week: local.getDay(),
  };
}
