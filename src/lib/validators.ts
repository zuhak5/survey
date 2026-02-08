import { z } from "zod";

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const submitRouteSchema = z.object({
  driver_id: z.string().uuid().optional(),
  client_request_id: z.string().trim().min(8).max(128).optional(),
  start: latLngSchema,
  end: latLngSchema,
  price: z.number().int().min(500).max(200_000),
  vehicle_type: z.string().trim().min(1).max(30).optional(),
  traffic_level: z.number().int().min(1).max(5).optional(),
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
