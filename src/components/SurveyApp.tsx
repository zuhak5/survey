"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPicker, type RouteInfo } from "@/components/MapPicker";
import { PriceChooser } from "@/components/PriceChooser";
import {
  derivePresetPrices,
  haversineDistanceMeters,
  type LatLng,
} from "@/lib/pricing";

type Step = "start" | "end" | "details" | "done";

type PlaceState = {
  point: LatLng;
  label: string | null;
};

type Suggestion = {
  suggested_price: number | null;
  confidence: number;
  count: number;
  cluster_id: string | null;
};

function stepProgress(step: Step): number {
  if (step === "start") return 25;
  if (step === "end") return 50;
  if (step === "details") return 85;
  return 100;
}

function formatDistance(distanceM: number): string {
  const nf = new Intl.NumberFormat("ar-IQ");
  if (!Number.isFinite(distanceM) || distanceM <= 0) {
    return "-";
  }

  if (distanceM >= 1000) {
    const km = distanceM / 1000;
    return `${nf.format(Number(km.toFixed(1)))} كم`;
  }

  return `${nf.format(Math.round(distanceM))} م`;
}

function formatEta(etaS: number): string {
  const nf = new Intl.NumberFormat("ar-IQ");
  if (!Number.isFinite(etaS) || etaS <= 0) {
    return "-";
  }

  const minutes = Math.max(1, Math.round(etaS / 60));
  if (minutes < 60) {
    return `${nf.format(minutes)} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) {
    return `${nf.format(hours)} ساعة`;
  }
  return `${nf.format(hours)} ساعة ${nf.format(rem)} دقيقة`;
}

function timeBucketFor(timeOfDay: "day" | "night"): number {
  return timeOfDay === "day" ? 12 : 22;
}

export function SurveyApp() {
  const [step, setStep] = useState<Step>("start");
  const [startPlace, setStartPlace] = useState<PlaceState | null>(null);
  const [endPlace, setEndPlace] = useState<PlaceState | null>(null);

  const [timeOfDay, setTimeOfDay] = useState<"day" | "night">("day");
  const [trafficLevel, setTrafficLevel] = useState<1 | 2 | 3>(2);

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const startPlaceRef = useRef<PlaceState | null>(null);
  const endPlaceRef = useRef<PlaceState | null>(null);
  const timeOfDayRef = useRef<"day" | "night">("day");

  useEffect(() => {
    startPlaceRef.current = startPlace;
  }, [startPlace]);

  useEffect(() => {
    endPlaceRef.current = endPlace;
  }, [endPlace]);

  useEffect(() => {
    timeOfDayRef.current = timeOfDay;
  }, [timeOfDay]);

  const baselinePrice = useMemo(() => {
    const distanceM =
      routeInfo?.distance_m ??
      (startPlace && endPlace
        ? haversineDistanceMeters(startPlace.point, endPlace.point)
        : 0);
    const [, baseline] = derivePresetPrices(distanceM);
    return baseline;
  }, [endPlace, routeInfo?.distance_m, startPlace]);

  const resolvedPrice = useMemo(() => {
    const trimmed = customPrice.trim();
    const custom = Number(trimmed);
    if (trimmed.length >= 4 && Number.isFinite(custom) && custom >= 1_000) {
      return custom;
    }
    return selectedPrice;
  }, [customPrice, selectedPrice]);

  const onRouteInfo = useCallback((info: RouteInfo | null) => setRouteInfo(info), []);

  const fetchSuggestion = useCallback(
    async (start: LatLng, end: LatLng, time: "day" | "night") => {
      try {
        const timeBucket = timeBucketFor(time);
        const response = await fetch(
          `/api/suggest-price?start=${start.lat},${start.lng}&end=${end.lat},${end.lng}&time_bucket=${timeBucket}&day_of_week=-1`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok) {
          setSuggestion(null);
          return;
        }
        setSuggestion({
          suggested_price: payload.suggested_price ?? null,
          confidence: payload.confidence ?? 0,
          count: payload.count ?? 0,
          cluster_id: payload.cluster_id ?? null,
        });
      } catch {
        setSuggestion(null);
      }
    },
    [],
  );

  const onSelectPoint = useCallback(
    (kind: "start" | "end", point: LatLng, label: string | null) => {
      setError(null);
      setSuccessMessage(null);

      if (kind === "start") {
        const nextStart = { point, label };
        startPlaceRef.current = nextStart;
        setStartPlace(nextStart);
        setEndPlace(null);
        endPlaceRef.current = null;
        setSuggestion(null);
        setSelectedPrice(null);
        setCustomPrice("");
        setRouteInfo(null);
        setStep("end");
        return;
      }

      const nextEnd = { point, label };
      endPlaceRef.current = nextEnd;
      setEndPlace(nextEnd);
      const currentStart = startPlaceRef.current;
      if (currentStart) {
        const [, baseline] = derivePresetPrices(
          haversineDistanceMeters(currentStart.point, nextEnd.point),
        );
        setSelectedPrice(baseline);
      } else {
        setSelectedPrice(null);
      }
      setCustomPrice("");
      setStep("details");

      if (currentStart) {
        void fetchSuggestion(currentStart.point, nextEnd.point, timeOfDayRef.current);
      } else {
        setSuggestion(null);
      }
    },
    [fetchSuggestion],
  );

  async function submit() {
    if (!startPlace || !endPlace) {
      setError("حدد نقطة الانطلاق ونقطة الوصول.");
      return;
    }
    if (!resolvedPrice) {
      setError("اختر السعر أو اكتب السعر (4 أرقام على الأقل).");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const response = await fetch("/api/submit-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_request_id: requestId,
        start: startPlace.point,
        end: endPlace.point,
        start_label: startPlace.label ?? undefined,
        end_label: endPlace.label ?? undefined,
        time_of_day: timeOfDay,
        traffic_level: trafficLevel,
        eta_s: routeInfo?.eta_s ?? undefined,
        price: resolvedPrice,
      }),
    });

    const payload = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      setError(payload?.error ?? "فشل الإرسال. حاول مرة أخرى.");
      return;
    }

    setStep("done");
    setSuccessMessage("شكراً لك! تم تسجيل السعر.");
  }

  const activeMapStep = step === "start" || step === "end" ? step : "end";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="rounded-3xl bg-white/85 p-5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
              استبيان أسعار السائقين
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              اضغط مرة لتحديد الانطلاق، ومرة لتحديد الوصول، ثم اختر الوقت والازدحام والسعر.
            </p>
          </div>
          <a
            href="/admin"
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            لوحة الإدارة
          </a>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all"
            style={{ width: `${stepProgress(step)}%` }}
          />
        </div>

        <div className="mt-5 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700">
              {step === "start" && "1) حدد نقطة الانطلاق"}
              {step === "end" && "2) حدد نقطة الوصول"}
              {(step === "details" || step === "done") && "3) اختر الوقت والازدحام والسعر"}
            </p>
          </section>

          <MapPicker
            start={startPlace?.point ?? null}
            end={endPlace?.point ?? null}
            activeStep={activeMapStep}
            onSelectPoint={onSelectPoint}
            selectionEnabled={step === "start" || step === "end"}
            timeOfDay={timeOfDay}
            trafficLevel={trafficLevel}
            onRouteInfo={onRouteInfo}
          />

          {(startPlace || endPlace) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">ملخص المسار</h2>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">من:</span>{" "}
                {startPlace?.label ?? "غير محدد"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-semibold">إلى:</span> {endPlace?.label ?? "غير محدد"}
              </p>

              {startPlace && endPlace && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    المسافة:{" "}
                    <span className="font-bold">{formatDistance(routeInfo?.distance_m ?? 0)}</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    الوقت المتوقع:{" "}
                    <span className="font-bold">{formatEta(routeInfo?.eta_s ?? 0)}</span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setStep("start");
                    setStartPlace(null);
                    setEndPlace(null);
                    setSuggestion(null);
                    setSelectedPrice(null);
                    setCustomPrice("");
                    setRouteInfo(null);
                    setSuccessMessage(null);
                    setError(null);
                  }}
                >
                  إعادة اختيار المسار
                </button>
                {startPlace && !endPlace && (
                  <button
                    type="button"
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                    onClick={() => setStep("end")}
                  >
                    التالي
                  </button>
                )}
              </div>
            </section>
          )}

          {startPlace && endPlace && step !== "start" && step !== "end" && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-slate-900">وقت الرحلة والازدحام</h2>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">وقت اليوم</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`rounded-xl px-4 py-3 text-sm font-bold ${
                          timeOfDay === "day"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                        }`}
                        onClick={() => {
                          const next = "day" as const;
                          setTimeOfDay(next);
                          const s = startPlaceRef.current;
                          const e = endPlaceRef.current;
                          if (s && e) {
                            void fetchSuggestion(s.point, e.point, next);
                          }
                        }}
                      >
                        نهار
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-4 py-3 text-sm font-bold ${
                          timeOfDay === "night"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                        }`}
                        onClick={() => {
                          const next = "night" as const;
                          setTimeOfDay(next);
                          const s = startPlaceRef.current;
                          const e = endPlaceRef.current;
                          if (s && e) {
                            void fetchSuggestion(s.point, e.point, next);
                          }
                        }}
                      >
                        ليل
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500">الازدحام</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-3 text-sm font-bold ${
                          trafficLevel === 1
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                        }`}
                        onClick={() => setTrafficLevel(1)}
                      >
                        خفيف
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-3 text-sm font-bold ${
                          trafficLevel === 2
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                        }`}
                        onClick={() => setTrafficLevel(2)}
                      >
                        متوسط
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-3 text-sm font-bold ${
                          trafficLevel === 3
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                        }`}
                        onClick={() => setTrafficLevel(3)}
                      >
                        زحام
                      </button>
                    </div>
                  </div>
                </div>

                {suggestion && suggestion.count > 0 && suggestion.suggested_price ? (
                  <p className="mt-3 text-xs text-slate-600">
                    توفر بيانات لعدد{" "}
                    <span className="font-bold text-slate-900">{suggestion.count}</span> رحلة مشابهة
                    (ثقة{" "}
                    <span className="font-bold text-slate-900">
                      {Number(suggestion.confidence).toFixed(2)}
                    </span>
                    ).
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-slate-600">
                    لا توجد بيانات كافية لرحلات مشابهة حتى الآن. السعر المبدئي يعتمد على المسافة.
                  </p>
                )}
              </section>

              <PriceChooser
                baselinePrice={baselinePrice}
                suggestedPrice={suggestion && suggestion.count > 0 ? suggestion.suggested_price : null}
                selectedPrice={selectedPrice}
                customPrice={customPrice}
                onSelectPrice={(value) => {
                  setSelectedPrice(value);
                  setCustomPrice("");
                }}
                onCustomPrice={(value) => setCustomPrice(value)}
              />

              {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
              {successMessage && (
                <p className="text-sm font-semibold text-emerald-700">{successMessage}</p>
              )}

              <button
                type="button"
                className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? "جاري الإرسال..." : "إرسال"}
              </button>

              {step === "done" && (
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    setStep("start");
                    setStartPlace(null);
                    setEndPlace(null);
                    setSuggestion(null);
                    setSelectedPrice(null);
                    setCustomPrice("");
                    setRouteInfo(null);
                    setSuccessMessage(null);
                    setError(null);
                  }}
                >
                  إرسال رحلة جديدة
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

