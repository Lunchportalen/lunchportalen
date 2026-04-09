// app/superadmin/firms/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";

import { osloTodayISODate } from "@/lib/date/oslo";
import { listFirms } from "@/lib/superadmin/queries";
import type { CompanyStatus, FirmsSortKey, SortDir } from "@/lib/superadmin/types";
import FirmsTable from "@/components/superadmin/FirmsTable";

import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

type SP = Record<string, string | string[] | undefined>;

function sp1(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function safeStatus(v: string): CompanyStatus | "ALL" {
  const s = String(v || "").toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s as CompanyStatus;
  return "ALL";
}

function safeSortKey(v: string): FirmsSortKey {
  const s = String(v || "");
  if (s === "name" || s === "status" || s === "created_at") return s;
  return "created_at";
}

function safeSortDir(v: string): SortDir {
  const s = String(v || "").toLowerCase();
  return s === "asc" ? "asc" : "desc";
}

function safeInt(v: string, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.floor(n);
  return Math.max(min, Math.min(max, x));
}

export default async function SuperadminFirmsPage(props: { searchParams?: SP }) {
  // -----------------------------
  // Auth + superadmin gate (FASET)
  // -----------------------------
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/firms");
  }

  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  // -----------------------------
  // Query params → listFirms
  // -----------------------------
  const sp = props.searchParams ?? {};
  const todayISO = osloTodayISODate();

  const q = sp1(sp.q);
  const status = safeStatus(sp1(sp.status));
  const page = safeInt(sp1(sp.page) || "1", 1, 1, 1_000_000);
  const pageSize = safeInt(sp1(sp.pageSize) || "50", 50, 10, 100);
  const sortKey = safeSortKey(sp1(sp.sortKey));
  const sortDir = safeSortDir(sp1(sp.sortDir));

  const data = await listFirms({ q, status, page, pageSize, sortKey, sortDir, todayISO });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lp-select-text">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Firma</h1>
        <p className="text-sm text-muted-foreground">
          Søk, filtrer og administrer firma. All visning er paginert og skalerer.
        </p>
      </header>

      <FirmsTable initial={data} />
    </main>
  );
}
