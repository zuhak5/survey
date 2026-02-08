"use client";

import { useMemo } from "react";
import { derivePresetPrices, haversineDistanceMeters, type LatLng } from "@/lib/pricing";

type PriceChooserProps = {
  start: LatLng;
  end: LatLng;
  selectedPrice: number | null;
  customPrice: string;
  onSelectPrice: (value: number) => void;
  onCustomPrice: (value: string) => void;
};

function formatIqd(value: number): string {
  return `${new Intl.NumberFormat("ar-IQ").format(value)} د.ع`;
}

export function PriceChooser({
  start,
  end,
  selectedPrice,
  customPrice,
  onSelectPrice,
  onCustomPrice,
}: PriceChooserProps) {
  const distanceM = useMemo(() => haversineDistanceMeters(start, end), [start, end]);
  const presets = useMemo(() => derivePresetPrices(distanceM), [distanceM]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">
        المسافة التقريبية: <span className="font-bold text-slate-900">{(distanceM / 1000).toFixed(2)} كم</span>
      </p>
      <h3 className="mt-2 text-lg font-extrabold text-slate-900">اختر السعر</h3>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {presets.map((price) => (
          <button
            key={price}
            type="button"
            className={`rounded-xl border px-4 py-4 text-lg font-black transition ${
              selectedPrice === price
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400"
            }`}
            onClick={() => onSelectPrice(price)}
          >
            {formatIqd(price)}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold text-slate-500">أو أدخل سعراً مخصصاً</label>
      <input
        type="number"
        min={500}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 outline-none focus:border-emerald-500"
        placeholder="مثال: 9000"
        value={customPrice}
        onChange={(event) => onCustomPrice(event.target.value)}
      />
    </section>
  );
}
