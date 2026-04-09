// app/superadmin/firms/[companyId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";
import ChangeCompanyAdmin from "./ChangeCompanyAdmin";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { formatDateTimeNO } from "@/lib/date/format";

// DB kan være lower/upper – vi normaliserer til UI (UPPERCASE)
type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
};

type LocationRow = {
  id: string;
  label: string;
  name: string;
};

type PageProps = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function normalizeStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s as CompanyStatus;

  const sl = String(v ?? "").trim().toLowerCase();
  if (sl === "active") return "ACTIVE";
  if (sl === "paused") return "PAUSED";
  if (sl === "closed") return "CLOSED";

  // Fail-safe
  return "PAUSED";
}

function fmtTs(ts: string) {
  return formatDateTimeNO(ts);
}

export default async function FirmPage({ params }: PageProps) {
  const p = (await params) as { companyId: string };
  const companyId = safeStr(p?.companyId);

  if (!companyId) notFound();
  if (!isUuid(companyId)) redirect("/superadmin/firms");

  const supabase = await supabaseServer();

  // ---- auth ----
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(`/login?next=/superadmin/firms/${encodeURIComponent(companyId)}`);
  }

  // ---- superadmin gate: profiles.role === "superadmin"
  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  // ---- company ----
  const { data: companyRaw, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) throw new Error(cErr.message);
  if (!companyRaw?.id) redirect("/superadmin/firms");

  const company: CompanyRow = {
    id: String(companyRaw.id),
    name: String(companyRaw.name ?? ""),
    orgnr: companyRaw.orgnr ? String(companyRaw.orgnr) : null,
    status: normalizeStatus((companyRaw as any).status),
    created_at: String(companyRaw.created_at ?? new Date().toISOString()),
    updated_at: String(companyRaw.updated_at ?? companyRaw.created_at ?? new Date().toISOString()),
  };

  // ---- locations ----
  const { data: locRows, error: lErr } = await supabase
    .from("company_locations")
    .select("id,label,name")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (lErr) throw new Error(lErr.message);

  const locations: LocationRow[] = (locRows ?? []).map((r: any) => ({
    id: String(r.id),
    label: String(r.label ?? ""),
    name: String(r.name ?? ""),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lp-select-text">
      {/* Top */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            <Link href="/superadmin/firms" className="hover:underline">
              ← Tilbake til firma
            </Link>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Firma: {company.name}</h1>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              ID: <span className="font-mono">{company.id}</span>
            </span>

            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Status: <span className="font-medium">{company.status}</span>
            </span>

            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Org.nr: <span className="font-mono">{company.orgnr ?? "—"}</span>
            </span>
          </div>

          {/* Full ansattoversikt (Superadmin) */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/superadmin/firms/${encodeURIComponent(company.id)}/employees`}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            >
              Ansatte (full oversikt)
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Sist oppdatert</div>
          <div className="mt-1 text-sm font-medium">{fmtTs(company.updated_at)}</div>
        </div>
      </div>

      {/* Locations */}
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Lokasjoner</div>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              Superadmin-rollebytte krever at firmaet har minst én lokasjon.
            </div>
          </div>

          <span className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
            Antall: <span className="font-medium">{locations.length}</span>
          </span>
        </div>

        {locations.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Ingen lokasjoner funnet for dette firmaet. Opprett minst én lokasjon før du kan sette firma-admin.
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-white ring-1 ring-[rgb(var(--lp-border))]">
            <table className="w-full text-sm">
              <thead className="bg-white/70 text-left text-xs text-[rgb(var(--lp-muted))]">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id} className="border-t border-[rgb(var(--lp-border))]">
                    <td className="px-4 py-3">{l.label}</td>
                    <td className="px-4 py-3">{l.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{l.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change admin */}
      <div className="mt-6">
        <ChangeCompanyAdmin companyId={company.id} companyName={company.name} locations={locations} />
      </div>
    </main>
  );
}
