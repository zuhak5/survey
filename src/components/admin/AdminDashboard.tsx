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
      setMessage(payload.error ?? "Failed to load cluster data.");
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
    setMessage("Running aggregation...");
    const response = await fetch("/api/admin/run-aggregation", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Aggregation failed.");
      return;
    }
    setMessage(
      `Aggregation complete: ${payload.clusters_refreshed} clusters, ${payload.feature_rows_upserted} feature rows.`,
    );
    await fetchClusters();
  }

  async function exportTrainingData() {
    setMessage("Preparing training export...");
    const response = await fetch("/api/admin/export-training", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Training export failed.");
      return;
    }
    setMessage(`Training export created: ${payload.file_path} (${payload.row_count} rows).`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Filters</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Date from"
            value={filters.date_from}
            onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
          />
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Date to"
            value={filters.date_to}
            onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Min count"
            value={filters.min_count}
            onChange={(event) => setFilters((prev) => ({ ...prev, min_count: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Min confidence 0..1"
            value={filters.min_confidence}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, min_confidence: event.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Vehicle type"
            value={filters.vehicle_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, vehicle_type: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Hour 0-23"
            value={filters.time_bucket}
            onChange={(event) => setFilters((prev) => ({ ...prev, time_bucket: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Day 0-6"
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
            {loading ? "Loading..." : "Load clusters"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            onClick={runAggregation}
          >
            Run aggregation now
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={exportTrainingData}
          >
            Export training data
          </button>
          <a
            href={csvUrl}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Download CSV
          </a>
        </div>

        {message && <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Heatmap</h2>
            <p className="mt-1 text-sm text-slate-600">
              Total clusters: {stats.total} | Low sample (&lt;5): {stats.lowSample} | Low confidence
              (&lt;0.5): {stats.lowConfidence}
              {stats.latestUpdated ? ` | Last updated: ${stats.latestUpdated}` : ""}
            </p>
          </div>
          {selectedCluster && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div className="font-bold">Selected</div>
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
              <p className="text-xs font-semibold text-slate-500">Median / IQR</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {selectedCluster.median_price} <span className="text-base font-bold">IQD</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">IQR: {selectedCluster.iqr_price}</p>
              <p className="mt-1 text-sm text-slate-700">
                Variance:{" "}
                {selectedCluster.price_variance === null
                  ? "-"
                  : Number(selectedCluster.price_variance).toFixed(0)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Samples / Confidence</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{selectedCluster.sample_count}</p>
              <p className="mt-1 text-sm text-slate-700">
                Confidence: {Number(selectedCluster.confidence_score).toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-slate-700">Updated: {selectedCluster.last_updated ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Dimensions</p>
              <p className="mt-1 text-sm text-slate-700">
                Vehicle: <span className="font-semibold">{selectedCluster.vehicle_type ?? "any"}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Hour:{" "}
                <span className="font-semibold">{selectedCluster.time_bucket ?? -1}</span> | Day:{" "}
                <span className="font-semibold">{selectedCluster.day_of_week ?? -1}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setSelectedClusterId(null)}
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedCluster.cluster_id);
                      setMessage("Cluster ID copied.");
                    } catch {
                      setMessage("Unable to copy cluster ID.");
                    }
                  }}
                >
                  Copy cluster_id
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Cluster Table</h2>
          <p className="text-sm text-slate-600">
            Total: {clusters.length} | Low sample (&lt;5):{" "}
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
