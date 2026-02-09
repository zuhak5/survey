"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        throw signInError;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("بيانات الدخول غير صحيحة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">تسجيل دخول الإدارة</h1>
        <p className="mt-2 text-sm text-slate-600">
          أدخل البريد الإلكتروني وكلمة المرور. لا يوجد إنشاء حساب من هنا.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              البريد الإلكتروني
            </label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-emerald-500"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">كلمة المرور</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-3 text-slate-900 outline-none focus:border-emerald-500"
              dir="ltr"
              autoComplete="current-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void signIn();
                }
              }}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}

        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          onClick={() => void signIn()}
          disabled={busy || email.trim().length < 5 || password.trim().length < 6}
        >
          {busy ? "..." : "تسجيل الدخول"}
        </button>
      </section>
    </main>
  );
}

