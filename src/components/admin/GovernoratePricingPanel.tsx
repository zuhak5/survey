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
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
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
      setDirty(false);
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

  function updateRow(code: string, patch: Partial<GovernoratePricing>) {
    setRows((prev) =>
      prev.map((row) => (row.governorate_code === code ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/governorate-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const payload = (await response.json()) as ApiResponse & { status?: string; error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "فشل حفظ التسعير.");
        setSaving(false);
        return;
      }

      setRows(payload.rows ?? rows);
      setDirty(false);
      setMessage("تم حفظ تسعير المحافظات.");
      setSaving(false);
    } catch {
      setMessage("فشل حفظ التسعير.");
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">تسعير المحافظات (العراق)</h2>
          <p className="mt-1 text-sm text-slate-600">
            عدّل التسعيرة الأساسية والزمنية والمسافة وحدود الـ Surge. المعاينات تساعدك على رؤية الناتج
            بسرعة.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            onClick={() => void fetchRows()}
            disabled={loading || saving}
          >
            {loading ? "..." : "تحديث"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void save()}
            disabled={saving || loading || !dirty}
          >
            {saving ? "جاري الحفظ..." : dirty ? "حفظ التغييرات" : "محفوظ"}
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>}

      <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-right text-slate-700">
            <tr>
              <th className="px-3 py-2">المحافظة</th>
              <th className="px-3 py-2">الأجرة الأساسية</th>
              <th className="px-3 py-2">الزمن / دقيقة</th>
              <th className="px-3 py-2">المسافة / كم</th>
              <th className="px-3 py-2">الحد الأدنى</th>
              <th className="px-3 py-2">معامل Surge</th>
              <th className="px-3 py-2">حد Surge</th>
              <th className="px-3 py-2">خطوة التقريب</th>
              <th className="px-3 py-2">مثال 5كم / 10د</th>
              <th className="px-3 py-2">مثال 1.5كم / 6د</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ex = examples[row.governorate_code];
              return (
                <tr key={row.governorate_code} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold text-slate-900">{row.name_ar}</td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.base_fare_iqd}
                      onChange={(e) => updateRow(row.governorate_code, { base_fare_iqd: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.time_fare_iqd_per_min}
                      onChange={(e) =>
                        updateRow(row.governorate_code, { time_fare_iqd_per_min: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.distance_fare_iqd_per_km}
                      onChange={(e) =>
                        updateRow(row.governorate_code, { distance_fare_iqd_per_km: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.minimum_fare_iqd}
                      onChange={(e) =>
                        updateRow(row.governorate_code, { minimum_fare_iqd: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={0.05}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.surge_multiplier}
                      onChange={(e) =>
                        updateRow(row.governorate_code, { surge_multiplier: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={0.05}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.surge_cap}
                      onChange={(e) => updateRow(row.governorate_code, { surge_cap: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={50}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-right font-semibold outline-none focus:border-emerald-500"
                      value={row.rounding_step_iqd}
                      onChange={(e) =>
                        updateRow(row.governorate_code, { rounding_step_iqd: Number(e.target.value) })
                      }
                    />
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
