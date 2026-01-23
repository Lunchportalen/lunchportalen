// app/admin/orders/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

import OrdersTable from "@/components/admin/OrdersTable";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Role helpers (samme prinsipp som middleware)
========================================================= */
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;

  const pr = String(profileRole ?? "").toLowerCase();
  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";

  return roleFromMetadata(user);
}

export default async function AdminOrdersPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/orders");

  // robust profile load (user_id først, så id)
  let profile:
    | { role: Role | null; company_id: string | null; location_id: string | null; full_name: string | null }
    | null = null;

  {
    const { data: p } = await supabase
      .from("profiles")
      .select("role, company_id, location_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (p) profile = p as any;
  }

  if (!profile) {
    const { data: p2 } = await supabase
      .from("profiles")
      .select("role, company_id, location_id, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (p2) profile = p2 as any;
  }

  const role = computeRole(user, profile?.role);

  // Kun superadmin og company_admin
  if (role !== "superadmin" && role !== "company_admin") redirect("/week");

  // company_admin må ha company_id
  if (role === "company_admin" && !profile?.company_id) redirect("/admin");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin – Ordrer</h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Oversikt per dag. Kontroll, ikke støy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            >
              ← Tilbake
            </Link>

            {role === "company_admin" && (
              <span className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]">
                Firma-ID: <span className="font-mono">{profile?.company_id ?? "—"}</span>
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <OrdersTable />
        </div>
      </div>
    </main>
  );
}
