"use client";

import { useMemo } from "react";

type PriceChooserProps = {
  baselinePrice: number;
  suggestedPrice: number | null;
  selectedPrice: number | null;
  customPrice: string;
  onSelectPrice: (value: number) => void;
  onCustomPrice: (value: string) => void;
};

function formatIqd(value: number): string {
  return `${new Intl.NumberFormat("ar-IQ").format(value)} د.ع`;
}

function buildWheelOptions(base: number): number[] {
  const step = 500;
  const low = Math.max(1_000, base - 6_000);
  const high = base + 6_000;

  const options: number[] = [];
  for (let p = low; p <= high; p += step) {
    options.push(p);
  }

  // Ensure common anchors exist.
  for (const anchor of [3_000, 4_000, 5_000, 7_500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000]) {
    if (anchor >= low && anchor <= high && !options.includes(anchor)) {
      options.push(anchor);
    }
  }

  options.sort((a, b) => a - b);
  return options;
}

export function PriceChooser({
  baselinePrice,
  suggestedPrice,
  selectedPrice,
  customPrice,
  onSelectPrice,
  onCustomPrice,
}: PriceChooserProps) {
  const base = useMemo(() => (suggestedPrice && suggestedPrice > 0 ? suggestedPrice : baselinePrice), [
    baselinePrice,
    suggestedPrice,
  ]);
  const options = useMemo(() => buildWheelOptions(base), [base]);
  const selectValue = selectedPrice === null ? "" : String(selectedPrice);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-extrabold text-slate-900">اختر السعر</h3>
      {suggestedPrice ? (
        <p className="mt-1 text-sm text-slate-600">
          سعر مقترح: <span className="font-bold text-slate-900">{formatIqd(suggestedPrice)}</span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-600">اختر السعر المناسب للرحلة.</p>
      )}

      <label className="mt-4 block text-xs font-semibold text-slate-500">عجلة السعر</label>
      <select
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-bold text-slate-900"
        value={selectValue}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= 1_000) {
            onSelectPrice(value);
          }
        }}
      >
        <option value="" disabled>
          اختر السعر
        </option>
        {options.map((price) => (
          <option key={price} value={price}>
            {formatIqd(price)}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-xs font-semibold text-slate-500">
        أو اكتب السعر (4 أرقام على الأقل)
      </label>
      <input
        inputMode="numeric"
        type="number"
        min={1_000}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 outline-none focus:border-emerald-500"
        placeholder="مثال: 9000"
        value={customPrice}
        onChange={(event) => onCustomPrice(event.target.value)}
      />
    </section>
  );
}

