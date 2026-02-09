import Link from "next/link";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">تسجيل الدخول مطلوب</h1>
          <p className="mt-2 text-sm text-slate-600">سجّل الدخول للوصول إلى لوحة الإدارة.</p>
          <Link
            href="/admin/login"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            تسجيل دخول الإدارة
          </Link>
          <div className="mt-3">
            <Link href="/" className="text-sm font-semibold text-slate-700 hover:underline">
              العودة إلى الاستبيان
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-bold text-amber-900">صلاحية غير كافية</h1>
          <p className="mt-2 text-sm text-amber-800">
            أضف معرّف المستخدم (auth.users.id) إلى جدول `public.admin_users` لمنح صلاحية الإدارة.
          </p>
        </div>
      </main>
    );
  }

  const { data: governoratePricingRows } = await supabase
    .from("governorate_pricing")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black text-slate-900">لوحة إدارة الأسعار</h1>
      <AdminDashboard initialGovernoratePricing={governoratePricingRows ?? []} />
    </main>
  );
}
