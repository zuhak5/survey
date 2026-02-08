import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";

function serializeCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const records = rows.map((row) =>
    headers
      .map((header) => {
        const raw = row[header];
        if (raw === null || raw === undefined) {
          return "";
        }
        return `"${String(raw).replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  return [headers.join(","), ...records].join("\n");
}

export async function POST() {
  const adminState = await assertAdmin();
  if (!adminState.ok) {
    return adminState.response;
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data: features, error: featureError } = await adminClient
      .from("feature_store")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20_000);

    if (featureError) {
      return jsonError(featureError.message, 500);
    }

    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const path = `training-export-${timestamp}.csv`;
    const csv = serializeCsv((features ?? []) as Record<string, unknown>[]);
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const { error: uploadError } = await adminClient.storage
      .from("training-exports")
      .upload(path, file, {
        contentType: "text/csv",
        upsert: false,
      });

    if (uploadError) {
      return jsonError(uploadError.message, 500);
    }

    const { error: insertError } = await adminClient.from("training_exports").insert({
      file_path: path,
      file_type: "csv",
      row_count: features?.length ?? 0,
      metadata: { source: "feature_store", generated_by: adminState.user.id },
    });

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    return NextResponse.json({
      status: "ok",
      file_path: path,
      row_count: features?.length ?? 0,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to export training data", 500);
  }
}
