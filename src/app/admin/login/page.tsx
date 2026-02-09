"use client";

import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";

export default function AdminLoginPage() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">تسجيل دخول الإدارة</h1>
        <p className="mt-2 text-sm text-slate-600">
          سجّل الدخول أولاً، ثم سيتم التحقق من صلاحيات حسابك. إذا لم يكن لديك دور{" "}
          <span className="font-bold">admin</span> فلن تتمكن من فتح لوحة الإدارة.
        </p>
      </div>

      <AuthCard
        onAuthed={() => {
          router.replace("/admin");
          router.refresh();
        }}
      />
    </main>
  );
}

