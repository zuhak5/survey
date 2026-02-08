"use client";

import { useMemo, useState } from "react";
import type { RouteCluster } from "@/lib/types";

type SortKey =
  | "sample_count"
  | "median_price"
  | "confidence_score"
  | "iqr_price"
  | "price_variance"
  | "last_updated";

type SortState = {
  key: SortKey;
  dir: "asc" | "desc";
};

type AdminTableProps = {
  clusters: RouteCluster[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toTime(value: string | null): number {
  if (!value) {
    return 0;
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function AdminTable({ clusters, selectedClusterId, onSelectCluster }: AdminTableProps) {
  const [sort, setSort] = useState<SortState>({ key: "sample_count", dir: "desc" });

  const sorted = useMemo(() => {
    const copy = [...clusters];
    copy.sort((a, b) => {
      let av = 0;
      let bv = 0;

      if (sort.key === "last_updated") {
        av = toTime(a.last_updated);
        bv = toTime(b.last_updated);
      } else if (sort.key === "price_variance") {
        av = a.price_variance === null ? -1 : toNumber(a.price_variance);
        bv = b.price_variance === null ? -1 : toNumber(b.price_variance);
      } else {
        av = toNumber((a as unknown as Record<string, unknown>)[sort.key]);
        bv = toNumber((b as unknown as Record<string, unknown>)[sort.key]);
      }

      const diff = av - bv;
      return sort.dir === "asc" ? diff : -diff;
    });
    return copy;
  }, [clusters, sort.dir, sort.key]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) {
        return { key, dir: "desc" };
      }
      return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
    });
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-right text-slate-700">
            <th className="px-2 py-2">cluster_id</th>
            <th className="px-2 py-2">dims</th>
            <th className="px-2 py-2">start</th>
            <th className="px-2 py-2">end</th>
            <th className="px-2 py-2">
              <button type="button" className="font-bold" onClick={() => toggleSort("median_price")}>
                median
              </button>
            </th>
            <th className="px-2 py-2">
              <button type="button" className="font-bold" onClick={() => toggleSort("iqr_price")}>
                iqr
              </button>
            </th>
            <th className="px-2 py-2">
              <button
                type="button"
                className="font-bold"
                onClick={() => toggleSort("price_variance")}
              >
                variance
              </button>
            </th>
            <th className="px-2 py-2">
              <button type="button" className="font-bold" onClick={() => toggleSort("sample_count")}>
                count
              </button>
            </th>
            <th className="px-2 py-2">
              <button
                type="button"
                className="font-bold"
                onClick={() => toggleSort("confidence_score")}
              >
                conf
              </button>
            </th>
            <th className="px-2 py-2">
              <button type="button" className="font-bold" onClick={() => toggleSort("last_updated")}>
                updated
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cluster) => {
            const isSelected = cluster.cluster_id === selectedClusterId;
            const isLowSample = cluster.sample_count < 5;
            const variance =
              cluster.price_variance === null ? "-" : Number(cluster.price_variance).toFixed(0);

            return (
              <tr
                key={cluster.cluster_id}
                className={`border-b border-slate-100 hover:bg-slate-50 ${
                  isSelected ? "bg-emerald-50" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectCluster(cluster.cluster_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectCluster(cluster.cluster_id);
                  }
                }}
              >
                <td className="px-2 py-2 font-mono text-xs">{cluster.cluster_id}</td>
                <td className="px-2 py-2 text-xs text-slate-700">
                  <div className="font-semibold">{cluster.vehicle_type ?? "any"}</div>
                  <div className="text-[11px] text-slate-500">
                    h:{cluster.time_bucket ?? -1} d:{cluster.day_of_week ?? -1}
                  </div>
                </td>
                <td className="px-2 py-2">
                  {Number(cluster.centroid_start_lat).toFixed(4)},{" "}
                  {Number(cluster.centroid_start_lng).toFixed(4)}
                </td>
                <td className="px-2 py-2">
                  {Number(cluster.centroid_end_lat).toFixed(4)},{" "}
                  {Number(cluster.centroid_end_lng).toFixed(4)}
                </td>
                <td className="px-2 py-2 font-semibold">{cluster.median_price}</td>
                <td className="px-2 py-2">{cluster.iqr_price}</td>
                <td className="px-2 py-2">{variance}</td>
                <td className="px-2 py-2">
                  <span className={isLowSample ? "font-bold text-rose-700" : ""}>
                    {cluster.sample_count}
                  </span>
                </td>
                <td className="px-2 py-2">{Number(cluster.confidence_score).toFixed(2)}</td>
                <td className="px-2 py-2 text-xs">{cluster.last_updated ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

