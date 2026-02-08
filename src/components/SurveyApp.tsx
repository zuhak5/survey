"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { MapPicker } from "@/components/MapPicker";
import { PriceChooser } from "@/components/PriceChooser";
import type { LatLng } from "@/lib/pricing";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Step = "start" | "end" | "price" | "review" | "done";

type PlaceState = {
  point: LatLng;
  label: string | null;
};

type Suggestion = {
  suggested_price: number | null;
  confidence: number;
  count: number;
};

function stepProgress(step: Step): number {
  if (step === "start") return 25;
  if (step === "end") return 50;
  if (step === "price") return 75;
  if (step === "review") return 90;
  return 100;
}

export function SurveyApp() {
  const [driverId, setDriverId] = useState<string | null>(null);
  const [startPlace, setStartPlace] = useState<PlaceState | null>(null);
  const [endPlace, setEndPlace] = useState<PlaceState | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [vehicleType, setVehicleType] = useState("sedan");
  const [trafficLevel, setTrafficLevel] = useState("3");
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setDriverId(data.user.id);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setDriverId(session?.user?.id ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const resolvedPrice = useMemo(() => {
    const custom = Number(customPrice);
    if (Number.isFinite(custom) && custom >= 500) {
      return custom;
    }
    return selectedPrice;
  }, [customPrice, selectedPrice]);

  async function fetchSuggestion(start: LatLng, end: LatLng) {
    try {
      const response = await fetch(
        `/api/suggest-price?start=${start.lat},${start.lng}&end=${end.lat},${end.lng}&vehicle_type=${vehicleType}`,
      );
      const payload = await response.json();
      setSuggestion({
        suggested_price: payload.suggested_price,
        confidence: payload.confidence ?? 0,
        count: payload.count ?? 0,
      });
    } catch {
      setSuggestion(null);
    }
  }

  function onSelectPoint(kind: "start" | "end", point: LatLng, label: string | null) {
    setError(null);
    setSuccessMessage(null);
    if (kind === "start") {
      setStartPlace({ point, label });
      setEndPlace(null);
      setStep("end");
      setSuggestion(null);
      return;
    }

    setEndPlace({ point, label });
    setStep("price");
    if (startPlace) {
      void fetchSuggestion(startPlace.point, point);
    }
  }

  async function submit() {
    if (!driverId || !startPlace || !endPlace || !resolvedPrice) {
      setError("تأكد من تسجيل الدخول وإكمال الخطوات.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    const requestId =
      clientRequestId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);
    setClientRequestId(requestId);

    const response = await fetch("/api/submit-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driver_id: driverId,
        client_request_id: requestId,
        start: startPlace.point,
        end: endPlace.point,
        price: resolvedPrice,
        vehicle_type: vehicleType,
        traffic_level: Number(trafficLevel),
      }),
    });

    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "فشل الإرسال.");
      return;
    }

    setStep("done");
    setSuccessMessage("شكراً لك! +1 مساهمة جديدة تم تسجيلها.");
    setSelectedPrice(null);
    setCustomPrice("");
    setClientRequestId(null);
  }

  const activeMapStep = step === "start" || step === "end" ? step : "end";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="rounded-3xl bg-white/85 p-5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">استبيان أسعار السائقين</h1>
            <p className="mt-1 text-sm text-slate-600">
              خطوة بخطوة: حدد البداية ثم النهاية ثم السعر.
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

        {!driverId && (
          <div className="mt-5">
            <AuthCard onAuthed={setDriverId} />
          </div>
        )}

        <div className="mt-5 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700">
              {step === "start" && "1) اختر نقطة الانطلاق"}
              {step === "end" && "2) اختر نقطة الوصول"}
              {step === "price" && "3) اختر السعر"}
              {step === "review" && "راجع المعلومات"}
              {step === "done" && "تم الإرسال"}
            </p>
          </section>

          <MapPicker
            start={startPlace?.point ?? null}
            end={endPlace?.point ?? null}
            activeStep={activeMapStep}
            onSelectPoint={onSelectPoint}
          />

          {(startPlace || endPlace) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">تأكيد المسار</h2>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">A:</span>{" "}
                {startPlace?.label ?? "غير محدد"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-semibold">B:</span> {endPlace?.label ?? "غير محدد"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => {
                    setStep("start");
                    setStartPlace(null);
                    setEndPlace(null);
                    setSuggestion(null);
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

          {startPlace && endPlace && step !== "done" && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    نوع المركبة
                    <select
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                      value={vehicleType}
                      onChange={(event) => setVehicleType(event.target.value)}
                    >
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="van">Van</option>
                      <option value="pickup">Pickup</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    مستوى الزحام
                    <select
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                      value={trafficLevel}
                      onChange={(event) => setTrafficLevel(event.target.value)}
                    >
                      <option value="1">1 - خفيف</option>
                      <option value="2">2</option>
                      <option value="3">3 - متوسط</option>
                      <option value="4">4</option>
                      <option value="5">5 - شديد</option>
                    </select>
                  </label>
                </div>
              </section>

              <PriceChooser
                start={startPlace.point}
                end={endPlace.point}
                selectedPrice={selectedPrice}
                customPrice={customPrice}
                onSelectPrice={(value) => {
                  setSelectedPrice(value);
                  setCustomPrice("");
                  setStep("review");
                }}
                onCustomPrice={(value) => {
                  setCustomPrice(value);
                  setStep("review");
                }}
              />

              {suggestion?.suggested_price && (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-900">
                    سعر مقترح من بيانات المجتمع: {suggestion.suggested_price} د.ع
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    الثقة: {(suggestion.confidence * 100).toFixed(0)}% | عدد العينات:{" "}
                    {suggestion.count}
                  </p>
                </section>
              )}

              <button
                type="button"
                className="w-full rounded-2xl bg-slate-900 px-6 py-5 text-xl font-black text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={submit}
                disabled={submitting || !resolvedPrice || !driverId}
              >
                {submitting ? "جاري الحفظ..." : "حفظ الإرسال"}
              </button>
            </>
          )}

          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
          {successMessage && (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              {successMessage}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
