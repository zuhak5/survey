import { z } from "zod";

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const submitRouteSchema = z.object({
  client_request_id: z.string().trim().min(8).max(128),
  start: latLngSchema,
  end: latLngSchema,
  start_label: z.string().trim().min(1).max(200).optional(),
  end_label: z.string().trim().min(1).max(200).optional(),
  time_of_day: z.enum(["day", "night"]),
  traffic_level: z.number().int().min(1).max(3),
  eta_s: z.number().int().min(0).max(86_400).optional(),
  price: z.number().int().min(1_000).max(200_000),
});

export type SubmitRoutePayload = z.infer<typeof submitRouteSchema>;

export const clusterFilterSchema = z.object({
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  time_bucket: z.coerce.number().int().min(0).max(23).optional(),
  day_of_week: z.coerce.number().int().min(0).max(6).optional(),
  vehicle_type: z.string().trim().min(1).max(30).optional(),
  min_count: z.coerce.number().int().min(0).max(1_000_000).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(2_000).optional().default(300),
});

export type ClusterFilters = z.infer<typeof clusterFilterSchema>;

export const governoratePricingRowSchema = z.object({
  governorate_code: z.string().trim().min(2).max(40),
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  sort_order: z.coerce.number().int().min(0).max(100),

  base_fare_iqd: z.coerce.number().int().min(0).max(1_000_000),
  time_fare_iqd_per_min: z.coerce.number().int().min(0).max(100_000),
  distance_fare_iqd_per_km: z.coerce.number().int().min(0).max(100_000),
  minimum_fare_iqd: z.coerce.number().int().min(0).max(1_000_000),

  surge_multiplier: z.coerce.number().min(1).max(10),
  surge_cap: z.coerce.number().min(1).max(10),
  rounding_step_iqd: z.coerce.number().int().min(1).max(10_000),

  notes: z.string().trim().max(500).optional().nullable(),
});

export const governoratePricingUpsertSchema = z.object({
  rows: z.array(governoratePricingRowSchema).min(1).max(50),
});

export type GovernoratePricingRowInput = z.infer<typeof governoratePricingRowSchema>;
