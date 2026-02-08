import { NextRequest, NextResponse } from "next/server";
import { runAggregationNow } from "@/lib/aggregation";
import { serverEnv } from "@/lib/env";
import { jsonError } from "@/lib/http";

function authorizedBySecret(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const bearer = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  return bearer === `Bearer ${secret}` || cronHeader === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizedBySecret(request)) {
    return jsonError("Unauthorized cron request", 401);
  }

  try {
    const result = await runAggregationNow();
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Aggregation run failed",
      500,
    );
  }
}
