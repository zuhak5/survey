import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/require-admin";
import { clusterFilterSchema } from "@/lib/validators";
import { clustersToCsv, fetchClustersForAdmin } from "@/lib/admin-queries";
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const adminState = await assertAdmin(request);
  if (!adminState.ok) {
    return adminState.response;
  }

  const filterCandidate = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = clusterFilterSchema.safeParse(filterCandidate);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid query params", 400);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const clusters = await fetchClustersForAdmin(supabase, parsed.data);
    const csv = clustersToCsv(clusters);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="route-clusters-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to export CSV", 500);
  }
}
