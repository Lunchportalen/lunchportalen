// app/admin/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const role = String(user.user_metadata?.role ?? "employee");
  if (role !== "company_admin") redirect("/login");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Oversikt, ansatte og kontrollert ordrelogikk.
        </p>
      </div>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </div>
  );
}
