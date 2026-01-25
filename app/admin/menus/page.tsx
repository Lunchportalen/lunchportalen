// app/admin/menus/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SupportReportButton from "@/components/admin/SupportReportButton";
import MenusClient from "./MenusClient";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Role helpers (samme prinsipp som middleware/admin)
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

export default async function AdminMenusPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/menus");

  /**
   * ✅ FASIT:
   * profiles.id === auth.users.id
   * Ingen fallback til profiles.user_id
   *
   * Hvis profilen ikke finnes ennå (trigger-delay), lar vi role falle tilbake til metadata/byEmail.
   */
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  const role = computeRole(user, profile?.role);

  // Superadmin-only (enterprise)
  if (role !== "superadmin") redirect("/admin");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
            <h1 className="text-2xl font-semibold tracking-tight">Meny</h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Kvalitetssjekk og publisering av ukemeny (Man–Fre). Ingen redigering i portalen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            >
              Tilbake
            </Link>
          </div>
        </div>

        {/* Enterprise support hook (audit + RID) */}
        <div className="mt-6 rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Kontrollert drift</div>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Publisering er en driftshendelse. Ved avvik: logg med RID (audit) før du gjør manuelle tiltak.
          </p>
          <div className="mt-4">
            <SupportReportButton reason="SUPERADMIN_MENUS_GENERAL_REPORT" companyId={null} locationId={null} />
          </div>
        </div>

        <div className="mt-6">
          <MenusClient />
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Regel (låst)</div>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Superadmin kan kun styre synlighet/publisering. Innhold redigeres i Sanity. Mangelfull meny kan ikke publiseres.
          </p>
        </div>
      </div>
    </main>
  );
}
