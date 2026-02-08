const requiredPublic = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function readPublicEnv(key: (typeof requiredPublic)[number]): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  NEXT_PUBLIC_DISABLE_MAPS: process.env.NEXT_PUBLIC_DISABLE_MAPS === "1",
  NEXT_PUBLIC_TEST_AUTH_BYPASS: process.env.NEXT_PUBLIC_TEST_AUTH_BYPASS === "1",
};

export function assertPublicEnv(): void {
  for (const key of requiredPublic) {
    readPublicEnv(key);
  }
}

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  CRON_SECRET: process.env.CRON_SECRET ?? "",
  TEST_AUTH_BYPASS_ENABLED: process.env.TEST_AUTH_BYPASS_ENABLED === "1",
  TEST_AUTH_BYPASS_DRIVER_ID:
    process.env.TEST_AUTH_BYPASS_DRIVER_ID ?? "11111111-1111-4111-8111-111111111111",
};
