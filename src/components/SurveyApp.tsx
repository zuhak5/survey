"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPicker, type PlaceInfo, type RouteInfo } from "@/components/MapPicker";
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
  governorate_code: string | null;
  governorate_name: string | null;
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

function formatIqd(value: number): string {
  return `${new Intl.NumberFormat("ar-IQ").format(Math.round(value))} د.ع`;
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
    (kind: "start" | "end", point: LatLng, place: PlaceInfo) => {
      setError(null);
      setSuccessMessage(null);

      if (kind === "start") {
        const nextStart = {
          point,
          label: place.label,
          governorate_code: place.governorate_code,
          governorate_name: place.governorate_name,
        };
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

      const nextEnd = {
        point,
        label: place.label,
        governorate_code: place.governorate_code,
        governorate_name: place.governorate_name,
      };
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
        start_governorate_code: startPlace.governorate_code ?? undefined,
        end_governorate_code: endPlace.governorate_code ?? undefined,
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

  const showRouteSummary = Boolean(startPlace || endPlace);
  const showDetailsForm = Boolean(startPlace && endPlace && step === "details");
  const showDone = step === "done";

  const stepIndex = step === "start" ? 1 : step === "end" ? 2 : 3;
  const stepTitle =
    step === "start"
      ? "حدد نقطة الانطلاق"
      : step === "end"
        ? "حدد نقطة الوصول"
        : step === "details"
          ? "اختر الوقت والازدحام والسعر"
          : "تم الإرسال";

  const stepHint =
    step === "start"
      ? "اضغط على الخريطة لتحديد الانطلاق. يمكنك استخدام زر «موقعي»."
      : step === "end"
        ? "اضغط مرة ثانية لتحديد الوصول. كلما كانت النقاط دقيقة، كانت النتائج أفضل."
        : step === "details"
          ? "اختر وقت الرحلة والازدحام ثم ضع السعر الحقيقي للمشوار."
          : "شكراً لمساهمتك. هل يمكنك إرسال رحلة ثانية؟";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="rounded-3xl bg-white/85 p-6 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">
                بدون تسجيل
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                أقل من دقيقة
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                بيانات مجهولة
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
              ساعدنا نبني{" "}
              <span className="bg-gradient-to-l from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                تسعير أدق
              </span>{" "}
              للمشاوير في العراق
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700 sm:text-base">
              حدد نقطتين على الخريطة، اختر وقت الرحلة والازدحام، ثم أدخل السعر الحقيقي. مساهمتك تجعل
              الاقتراحات أدق مع الوقت.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-600">التقدم</p>
              <p className="text-xs font-black text-slate-900">خطوة {stepIndex} / 3</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all"
                style={{ width: `${stepProgress(step)}%` }}
              />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-900">{stepTitle}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{stepHint}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { key: "start", label: "الانطلاق" },
            { key: "end", label: "الوصول" },
            { key: "details", label: "السعر" },
          ].map((s) => {
            const isCurrent =
              (s.key === "start" && step === "start") ||
              (s.key === "end" && step === "end") ||
              (s.key === "details" && (step === "details" || step === "done"));
            const isComplete =
              (s.key === "start" && (step === "end" || step === "details" || step === "done")) ||
              (s.key === "end" && (step === "details" || step === "done")) ||
              (s.key === "details" && step === "done");

            return (
              <div
                key={s.key}
                className={`rounded-2xl px-3 py-3 text-center ring-1 transition ${
                  isCurrent
                    ? "bg-emerald-600 text-white ring-emerald-600"
                    : isComplete
                      ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
                      : "bg-white text-slate-900 ring-slate-200"
                }`}
              >
                <p className="text-xs font-black opacity-80">خطوة</p>
                <p className="mt-0.5 text-sm font-black">{s.label}</p>
              </div>
            );
          })}
        </div>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-7">
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

          {showRouteSummary && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">ملخص المسار</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    تأكد من صحة النقطتين قبل إدخال السعر.
                  </p>
                </div>

                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
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
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <p className="text-xs font-black text-slate-500">من</p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {startPlace?.label ?? "غير محدد"}
                  </p>
                  {startPlace?.governorate_name && (
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {startPlace.governorate_name}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <p className="text-xs font-black text-slate-500">إلى</p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {endPlace?.label ?? "غير محدد"}
                  </p>
                  {endPlace?.governorate_name && (
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {endPlace.governorate_name}
                    </p>
                  )}
                </div>
              </div>

              {startPlace && endPlace && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200">
                    <p className="text-xs font-black text-slate-500">المسافة</p>
                    <p className="mt-1 text-base font-black">
                      {formatDistance(routeInfo?.distance_m ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200">
                    <p className="text-xs font-black text-slate-500">الوقت المتوقع</p>
                    <p className="mt-1 text-base font-black">{formatEta(routeInfo?.eta_s ?? 0)}</p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900">{stepTitle}</h2>
                <p className="mt-1 text-sm text-slate-600">{stepHint}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {stepIndex}/3
              </span>
            </div>

            {step === "end" && startPlace && !endPlace && (
              <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-100">
                تم تحديد الانطلاق. الآن حدد الوصول.
              </div>
            )}

            {step === "start" && !startPlace && (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                نصيحة: إذا كنت داخل السيارة، استخدم زر «موقعي» لتحديد الانطلاق بسرعة.
              </div>
            )}
          </section>

          {showDetailsForm && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-black text-slate-900">وقت الرحلة والازدحام</h2>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black text-slate-500">وقت اليوم</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`rounded-2xl px-4 py-3 text-sm font-black ${
                          timeOfDay === "day"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-900 hover:bg-slate-200"
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
                        className={`rounded-2xl px-4 py-3 text-sm font-black ${
                          timeOfDay === "night"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-900 hover:bg-slate-200"
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
                    <p className="text-xs font-black text-slate-500">الازدحام</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { v: 1 as const, label: "خفيف" },
                        { v: 2 as const, label: "متوسط" },
                        { v: 3 as const, label: "زحام" },
                      ].map((t) => (
                        <button
                          key={t.v}
                          type="button"
                          className={`rounded-2xl px-3 py-3 text-sm font-black ${
                            trafficLevel === t.v
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                          }`}
                          onClick={() => setTrafficLevel(t.v)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {suggestion && suggestion.count > 0 && suggestion.suggested_price ? (
                  <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                    <p className="text-xs font-black text-emerald-900">مرجع من بيانات مشابهة</p>
                    <p className="mt-1 text-base font-black text-emerald-950">
                      {formatIqd(suggestion.suggested_price)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-900">
                      {suggestion.count} رحلة | ثقة {Number(suggestion.confidence).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                    <p className="text-xs font-black text-slate-700">أنت من أوائل المشاركين هنا</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      لا توجد بيانات كافية لرحلات مشابهة بعد. سعرك سيحسّن المرجع للمستخدمين القادمين.
                    </p>
                  </div>
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

              <button
                type="button"
                className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                onClick={submit}
                disabled={submitting || !resolvedPrice}
              >
                {submitting ? "جاري الإرسال..." : resolvedPrice ? `إرسال (${formatIqd(resolvedPrice)})` : "إرسال"}
              </button>

              <p className="text-xs font-semibold text-slate-500">
                ملاحظة: نستخدم نقاط المسار + الوقت + الازدحام + السعر فقط لتحسين الاقتراحات. لا نطلب
                تسجيل.
              </p>
            </>
          )}

          {showDone && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <h2 className="text-lg font-black text-emerald-950">تم الإرسال</h2>
              <p className="mt-2 text-sm font-semibold text-emerald-900">
                {successMessage ?? "شكراً لك! تم تسجيل السعر."}
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-black text-white hover:bg-slate-800"
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
            </section>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">© Survey</span>
            <a href="/admin" className="font-bold text-slate-600 hover:underline">
              دخول الإدارة
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

