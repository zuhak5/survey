import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/require-admin";
import { jsonError } from "@/lib/http";
import { runAggregationNow } from "@/lib/aggregation";

export async function POST() {
  const adminState = await assertAdmin();
  if (!adminState.ok) {
    return adminState.response;
  }

  try {
    const result = await runAggregationNow();
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to run aggregation",
      500,
    );
  }
}
