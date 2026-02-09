"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminHeatmap } from "@/components/admin/AdminHeatmap";
import { AdminTable } from "@/components/admin/AdminTable";
import type { RouteCluster } from "@/lib/types";

type FilterState = {
  date_from: string;
  date_to: string;
  min_count: string;
  min_confidence: string;
  vehicle_type: string;
  time_bucket: string;
  day_of_week: string;
};

function toQueryString(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.date_from) params.set("date_from", new Date(filters.date_from).toISOString());
  if (filters.date_to) params.set("date_to", new Date(filters.date_to).toISOString());
  if (filters.min_count) params.set("min_count", filters.min_count);
  if (filters.min_confidence) params.set("min_confidence", filters.min_confidence);
  if (filters.vehicle_type) params.set("vehicle_type", filters.vehicle_type);
  if (filters.time_bucket) params.set("time_bucket", filters.time_bucket);
  if (filters.day_of_week) params.set("day_of_week", filters.day_of_week);
  params.set("limit", "500");
  return params.toString();
}

export function AdminDashboard() {
  const [clusters, setClusters] = useState<RouteCluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    date_from: "",
    date_to: "",
    min_count: "3",
    min_confidence: "0",
    vehicle_type: "",
    time_bucket: "",
    day_of_week: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const csvUrl = useMemo(() => `/api/admin/export-csv?${toQueryString(filters)}`, [filters]);

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.cluster_id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );

  const stats = useMemo(() => {
    const total = clusters.length;
    const lowSample = clusters.filter((cluster) => cluster.sample_count < 5).length;
    const lowConfidence = clusters.filter((cluster) => cluster.confidence_score < 0.5).length;
    const latestUpdated = clusters.reduce<string | null>((acc, cluster) => {
      if (!cluster.last_updated) {
        return acc;
      }
      if (!acc) {
        return cluster.last_updated;
      }
      return Date.parse(cluster.last_updated) > Date.parse(acc) ? cluster.last_updated : acc;
    }, null);

    return { total, lowSample, lowConfidence, latestUpdated };
  }, [clusters]);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setSelectedClusterId(null);

    const query = toQueryString(filters);
    const response = await fetch(`/api/admin/clusters?${query}`, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setLoading(false);
      setMessage(payload.error ?? "فشل تحميل بيانات التجمعات.");
      return;
    }

    setClusters(payload.clusters ?? []);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    void fetchClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAggregation() {
    setMessage("جاري تشغيل التجميع...");
    const response = await fetch("/api/admin/run-aggregation", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "فشل التجميع.");
      return;
    }
    setMessage(
      `اكتمل التجميع: ${payload.clusters_refreshed} تجمع، و ${payload.feature_rows_upserted} سجل ميزات.`,
    );
    await fetchClusters();
  }

  async function exportTrainingData() {
    setMessage("جاري تجهيز تصدير التدريب...");
    const response = await fetch("/api/admin/export-training", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "فشل تصدير التدريب.");
      return;
    }
    setMessage(`تم إنشاء تصدير التدريب: ${payload.file_path} (${payload.row_count} صف).`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">المرشحات</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="من"
            value={filters.date_from}
            onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
          />
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="إلى"
            value={filters.date_to}
            onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="الحد الأدنى للعدد"
            value={filters.min_count}
            onChange={(event) => setFilters((prev) => ({ ...prev, min_count: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="الحد الأدنى للثقة 0..1"
            value={filters.min_confidence}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, min_confidence: event.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="نوع المركبة"
            value={filters.vehicle_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, vehicle_type: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="الساعة 0-23"
            value={filters.time_bucket}
            onChange={(event) => setFilters((prev) => ({ ...prev, time_bucket: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="اليوم 0-6"
            value={filters.day_of_week}
            onChange={(event) => setFilters((prev) => ({ ...prev, day_of_week: event.target.value }))}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={fetchClusters}
            disabled={loading}
          >
            {loading ? "جاري التحميل..." : "تحميل التجمعات"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            onClick={runAggregation}
          >
            تشغيل التجميع الآن
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={exportTrainingData}
          >
            تصدير بيانات التدريب
          </button>
          <a
            href={csvUrl}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            تنزيل CSV
          </a>
        </div>

        {message && <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">الخريطة الحرارية</h2>
            <p className="mt-1 text-sm text-slate-600">
              إجمالي التجمعات: {stats.total} | عينات قليلة (&lt;5): {stats.lowSample} | ثقة منخفضة
              (&lt;0.5): {stats.lowConfidence}
              {stats.latestUpdated ? ` | آخر تحديث: ${stats.latestUpdated}` : ""}
            </p>
          </div>
          {selectedCluster && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div className="font-bold">المحدد</div>
              <div className="font-mono">{selectedCluster.cluster_id}</div>
            </div>
          )}
        </div>

        <AdminHeatmap
          clusters={clusters}
          selectedClusterId={selectedClusterId}
          onSelectCluster={setSelectedClusterId}
        />

        {selectedCluster && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">الوسيط / IQR</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {selectedCluster.median_price} <span className="text-base font-bold">د.ع</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">IQR: {selectedCluster.iqr_price}</p>
              <p className="mt-1 text-sm text-slate-700">
                التباين:{" "}
                {selectedCluster.price_variance === null
                  ? "-"
                  : Number(selectedCluster.price_variance).toFixed(0)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">العينات / الثقة</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{selectedCluster.sample_count}</p>
              <p className="mt-1 text-sm text-slate-700">
                الثقة: {Number(selectedCluster.confidence_score).toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-slate-700">التحديث: {selectedCluster.last_updated ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">الأبعاد</p>
              <p className="mt-1 text-sm text-slate-700">
                المركبة: <span className="font-semibold">{selectedCluster.vehicle_type ?? "أي"}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">
                الساعة:{" "}
                <span className="font-semibold">{selectedCluster.time_bucket ?? -1}</span> | اليوم:{" "}
                <span className="font-semibold">{selectedCluster.day_of_week ?? -1}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setSelectedClusterId(null)}
                >
                  إلغاء التحديد
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedCluster.cluster_id);
                      setMessage("تم نسخ رقم التجمع.");
                    } catch {
                      setMessage("تعذر نسخ رقم التجمع.");
                    }
                  }}
                >
                  نسخ cluster_id
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">جدول التجمعات</h2>
          <p className="text-sm text-slate-600">
            الإجمالي: {clusters.length} | عينات قليلة (&lt;5):{" "}
            {clusters.filter((cluster) => cluster.sample_count < 5).length}
          </p>
        </div>
        <AdminTable
          clusters={clusters}
          selectedClusterId={selectedClusterId}
          onSelectCluster={setSelectedClusterId}
        />
      </section>
    </div>
  );
}
