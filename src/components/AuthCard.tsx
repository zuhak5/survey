"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { publicEnv } from "@/lib/env";

type AuthCardProps = {
  onAuthed: (driverId: string) => void;
};

type AuthMode = "phone" | "email";

export function AuthCard({ onAuthed }: AuthCardProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("phone");
  const [identity, setIdentity] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "phone") {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          phone: identity,
          options: { shouldCreateUser: true },
        });
        if (signInError) {
          throw signInError;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: identity,
          options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
        });
        if (signInError) {
          throw signInError;
        }
      }

      setOtpSent(true);
      setInfo("تم إرسال رمز التحقق.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الرمز.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp(
        mode === "phone"
          ? { phone: identity, token: otp, type: "sms" }
          : { email: identity, token: otp, type: "email" },
      );

      if (verifyError || !data.user) {
        throw verifyError ?? new Error("رمز غير صحيح.");
      }

      await fetch("/api/profile/sync", { method: "POST" });
      setInfo("تم تسجيل الدخول بنجاح.");
      onAuthed(data.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحقق.");
    } finally {
      setBusy(false);
    }
  }

  function enableTestBypass() {
    onAuthed("11111111-1111-4111-8111-111111111111");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">الدخول السريع</h2>
      <p className="mt-2 text-sm text-slate-600">
        سجل دخولك برقم الهاتف أو البريد الإلكتروني ثم أرسل السعر خلال ثواني.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            mode === "phone"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setMode("phone")}
        >
          هاتف
        </button>
        <button
          type="button"
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            mode === "email"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          onClick={() => setMode("email")}
        >
          بريد
        </button>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-xs font-semibold text-slate-500">
          {mode === "phone" ? "رقم الهاتف" : "البريد الإلكتروني"}
        </label>
        <input
          className="w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-emerald-500"
          dir={mode === "phone" ? "ltr" : "auto"}
          placeholder={mode === "phone" ? "+9647XXXXXXXX" : "driver@example.com"}
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
        />
      </div>

      {otpSent && (
        <div className="mt-3">
          <label className="mb-2 block text-xs font-semibold text-slate-500">رمز التحقق</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-emerald-500"
            dir="ltr"
            placeholder="123456"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
      {info && <p className="mt-3 text-sm font-medium text-emerald-700">{info}</p>}

      {!otpSent ? (
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          onClick={sendOtp}
          disabled={busy || identity.trim().length < 4}
        >
          {busy ? "..." : "إرسال الرمز"}
        </button>
      ) : (
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          onClick={verifyOtp}
          disabled={busy || otp.trim().length < 4}
        >
          {busy ? "..." : "تأكيد الدخول"}
        </button>
      )}

      {publicEnv.NEXT_PUBLIC_TEST_AUTH_BYPASS && (
        <button
          type="button"
          className="mt-3 w-full rounded-xl border border-dashed border-amber-400 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50"
          onClick={enableTestBypass}
        >
          دخول تجريبي للاختبارات
        </button>
      )}
    </section>
  );
}
