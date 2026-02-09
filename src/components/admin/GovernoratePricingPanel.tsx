"use client";

import { useCallback, useMemo, useState } from "react";
import type { GovernoratePricing } from "@/lib/types";

function toIqd(value: number): string {
  return new Intl.NumberFormat("ar-IQ").format(Math.round(value));
}

function roundToStep(value: number, step: number): number {
  const s = Number.isFinite(step) && step > 0 ? step : 500;
  return Math.round(value / s) * s;
}

function estimateFareIqd(
  row: GovernoratePricing,
  distanceKm: number,
  durationMin: number,
): number {
  const base =
    Number(row.base_fare_iqd) +
    Number(row.distance_fare_iqd_per_km) * distanceKm +
    Number(row.time_fare_iqd_per_min) * durationMin;

  const surge = Math.min(Number(row.surge_multiplier), Number(row.surge_cap));
  const surged = base * (Number.isFinite(surge) ? surge : 1);
  const rounded = roundToStep(surged, Number(row.rounding_step_iqd));
  return Math.max(Number(row.minimum_fare_iqd), rounded);
}

type ApiResponse = { rows: GovernoratePricing[] };

export function GovernoratePricingPanel(props: { initialRows: GovernoratePricing[] }) {
  const [rows, setRows] = useState<GovernoratePricing[]>(() => props.initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchRows = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const response = await fetch("/api/admin/governorate-pricing", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setMessage((payload as unknown as { error?: string })?.error ?? "فشل تحميل تسعير المحافظات.");
        setLoading(false);
        return;
      }

      setRows(payload.rows ?? []);
      setLoading(false);
    } catch {
      setMessage("فشل تحميل تسعير المحافظات.");
      setLoading(false);
    }
  }, []);

  const examples = useMemo(() => {
    return rows.reduce<Record<string, { exA: number; exB: number }>>((acc, row) => {
      acc[row.governorate_code] = {
        exA: estimateFareIqd(row, 5, 10), // 5km / 10min
        exB: estimateFareIqd(row, 1.5, 6), // 1.5km / 6min
      };
      return acc;
    }, {});
  }, [rows]);

  const nf = useMemo(() => new Intl.NumberFormat("ar-IQ"), []);

  const df = useMemo(
    () =>
      new Intl.DateTimeFormat("ar-IQ", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [],
  );

  function fmtDate(value: string | null | undefined): string {
    if (!value) return "-";
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return "-";
    return df.format(new Date(ms));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">تحليل التسعير حسب المحافظة (العراق)</h2>
          <p className="mt-1 text-sm text-slate-600">
            هذه الأرقام تُحسب تلقائياً من استبيانات السائقين لمساعدتك في بناء نظام التسعير لتطبيق
            المشاوير. (Baseline: نهار + ازدحام متوسط).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void fetchRows()}
            disabled={loading}
          >
            {loading ? "..." : "تحديث"}
          </button>
          <a
            href="/api/admin/export-governorate-pricing"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            تنزيل CSV
          </a>
        </div>
      </div>

      {message && <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>}

      <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-[1280px] w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-right text-slate-700">
            <tr>
              <th className="px-3 py-2">المحافظة</th>
              <th className="px-3 py-2">الاستبيانات</th>
              <th className="px-3 py-2">Baseline</th>
              <th className="px-3 py-2">ازدحام شديد</th>
              <th className="px-3 py-2">ليل</th>
              <th className="px-3 py-2">عينات الملاءمة</th>
              <th className="px-3 py-2">MAE</th>
              <th className="px-3 py-2">الأجرة الأساسية</th>
              <th className="px-3 py-2">الزمن / دقيقة</th>
              <th className="px-3 py-2">المسافة / كم</th>
              <th className="px-3 py-2">الحد الأدنى</th>
              <th className="px-3 py-2">معامل Surge</th>
              <th className="px-3 py-2">حد Surge</th>
              <th className="px-3 py-2">مثال 5كم / 10د</th>
              <th className="px-3 py-2">مثال 1.5كم / 6د</th>
              <th className="px-3 py-2">آخر استبيان</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ex = examples[row.governorate_code];
              const mae = row.fit_mae_iqd == null ? null : Number(row.fit_mae_iqd);
              return (
                <tr key={row.governorate_code} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold text-slate-900">{row.name_ar}</td>

                  <td className="px-3 py-2 font-semibold">{nf.format(row.submission_count ?? 0)}</td>
                  <td className="px-3 py-2 font-semibold">{nf.format(row.baseline_count ?? 0)}</td>
                  <td className="px-3 py-2 font-semibold">{nf.format(row.jam_count ?? 0)}</td>
                  <td className="px-3 py-2 font-semibold">{nf.format(row.night_count ?? 0)}</td>
                  <td className="px-3 py-2 font-semibold">{nf.format(row.fit_sample_count ?? 0)}</td>
                  <td className="px-3 py-2 font-semibold">{mae == null ? "-" : `${toIqd(mae)} د.ع`}</td>

                  <td className="px-3 py-2 font-extrabold text-slate-900">{toIqd(Number(row.base_fare_iqd))}</td>
                  <td className="px-3 py-2 font-extrabold text-slate-900">{toIqd(Number(row.time_fare_iqd_per_min))}</td>
                  <td className="px-3 py-2 font-extrabold text-slate-900">{toIqd(Number(row.distance_fare_iqd_per_km))}</td>
                  <td className="px-3 py-2 font-extrabold text-slate-900">{toIqd(Number(row.minimum_fare_iqd))}</td>

                  <td className="px-3 py-2 font-extrabold text-slate-900">
                    {Number(row.surge_multiplier).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 font-extrabold text-slate-900">
                    {Number(row.surge_cap).toFixed(2)}
                  </td>

                  <td className="px-3 py-2 text-slate-800">
                    {ex ? (
                      <span className="font-extrabold">{toIqd(ex.exA)} د.ع</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {ex ? (
                      <span className="font-extrabold">{toIqd(ex.exB)} د.ع</span>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-3 py-2 text-slate-700">{fmtDate(row.last_submission_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        الصيغة المستخدمة في المعاينات:{" "}
        <span className="font-mono">
          max(minimum, round((base + km*distance + min*time) * min(surge, cap)))
        </span>
      </div>
    </section>
  );
}
