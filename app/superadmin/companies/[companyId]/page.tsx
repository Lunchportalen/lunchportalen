// app/superadmin/companies/[companyId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { supabaseServer } from "@/lib/supabase/server";
import Actions from "./Actions";
import StatusBadge, { type CompanyStatus as UiCompanyStatus } from "./StatusBadge";
import AuditFeed from "@/components/audit/AuditFeed";

/* =========================================================
   Types
========================================================= */
type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "pending" | "active" | "paused" | "closed";
type PlanTier = "BASIS" | "LUXUS";

type ProfileRow = { role: Role };

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus | null;
  created_at: string | null;
  updated_at: string | null;
  agreement_json?: any | null;
  plan_tier?: string | null;
  employee_count?: number | null;
};

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";

type DayView = {
  key: DayKey;
  label: string;
  enabled: boolean;
  tier: PlanTier | null;
  price_ex_vat: number | null;
  price_inc_vat: number | null;
};

/* =========================================================
   Helpers
========================================================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}

function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "Ukjent firma";
}

function normalizeStatus(v: any): CompanyStatus {
  const s = String(v ?? "pending").toLowerCase().trim();
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return "pending";
}

function formatISO(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("no-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function asTier(v: any): PlanTier | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "BASIS") return "BASIS";
  if (s === "LUXUS" || s === "LUKSUS") return "LUXUS";
  return null;
}

function buildDaysFromAgreement(agreement: any): DayView[] {
  const map: Record<DayKey, string> = {
    mon: "Mandag",
    tue: "Tirsdag",
    wed: "Onsdag",
    thu: "Torsdag",
    fri: "Fredag",
  };

  const keys: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
  const days = agreement?.plan?.days ?? agreement?.days ?? agreement?.agreement?.days ?? null;

  return keys.map((k) => {
    const raw = days?.[k] ?? null;
    const enabled = !!raw?.enabled;
    const tier = enabled ? (asTier(raw?.tier) ?? null) : null;

    const price_ex_vat = enabled ? n(raw?.price_ex_vat) : null;
    const price_inc_vat = enabled ? n(raw?.price_inc_vat) : null;

    return {
      key: k,
      label: map[k],
      enabled,
      tier,
      price_ex_vat,
      price_inc_vat,
    };
  });
}

function formatNOK(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  try {
    return new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${v} NOK`;
  }
}

function tierLabel(t: PlanTier | null) {
  if (!t) return "—";
  return t === "BASIS" ? "Basis" : "Luxus";
}

function tierPill(t: PlanTier | null) {
  if (t === "LUXUS") return "bg-black text-white ring-1 ring-black";
  if (t === "BASIS") return "bg-white text-black ring-1 ring-[rgb(var(--lp-border))]";
  return "bg-white/60 text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]";
}

function billingLabel(v: any) {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "every_14_days") return "Hver 14. dag";
  if (s === "monthly") return "Månedlig";
  if (s === "weekly") return "Ukentlig";
  return "—";
}

/**
 * Hard-fasit for superadmin.
 * Vi bruker e-post i tillegg til profiles.role for å unngå metadata-triksing og edge-cases.
 */
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isHardSuperadmin(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
}

/* =========================================================
   Page (Next.js 15: params can be Promise)
========================================================= */
export default async function SuperadminCompanyPage(props: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = safeStr(params.companyId);
  if (!companyId) notFound();

  const supabase = await supabaseServer();

  // 1) Auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect(`/login?next=/superadmin/companies/${encodeURIComponent(companyId)}`);
  }

  // 2) Role gate
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr || !profile) redirect("/login?next=/superadmin");
  if (profile.role !== "superadmin" || !isHardSuperadmin(user.email)) redirect("/week");

  // 3) Load company
  const { data: c, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at,agreement_json,plan_tier,employee_count")
    .eq("id", companyId)
    .maybeSingle<CompanyRow>();

  if (cErr) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-lg font-semibold">Firma</div>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente firma.</p>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700">{cErr.message}</pre>
          <div className="mt-4">
            <Link href="/superadmin" className="rounded-2xl border px-4 py-2 text-sm">
              Tilbake
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (!c) notFound();

  const status = normalizeStatus(c.status) as UiCompanyStatus;

  const agreement = c.agreement_json ?? null;
  const adminEmail = safeStr(agreement?.admin?.email) || "—";
  const adminName = safeStr(agreement?.admin?.full_name) || "—";
  const phone = safeStr(agreement?.admin?.phone) || "—";

  const days = buildDaysFromAgreement(agreement);
  const enabledDays = days.filter((d) => d.enabled);
  const basisCount = enabledDays.filter((d) => d.tier === "BASIS").length;
  const luxusCount = enabledDays.filter((d) => d.tier === "LUXUS").length;

  const planSummary =
    basisCount > 0 && luxusCount > 0
      ? `Blandingsplan: ${basisCount} dager Basis / ${luxusCount} dager Luxus`
      : luxusCount > 0
        ? `Luxus (${luxusCount} dager)`
        : basisCount > 0
          ? `Basis (${basisCount} dager)`
          : "—";

  const employeeCount =
    Number.isFinite(Number(c.employee_count))
      ? Number(c.employee_count)
      : Number(agreement?.company?.employee_count ?? NaN);

  const invoiceCadenceRaw = safeStr(agreement?.billing?.invoice_cadence) || "";

  return (
    <div className="lp-select-text mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin / Firma</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{safeName(c.name)}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Org.nr: {c.orgnr ?? "—"}
            </span>

            {/* ✅ Live-updating status badge */}
            <StatusBadge companyId={companyId} initialStatus={status} />
          </div>

          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{planSummary}</div>
        </div>

        <div className="text-xs text-[rgb(var(--lp-muted))]">
          Sist endret: {formatISO(c.updated_at)} <br />
          Opprettet: {formatISO(c.created_at)}
        </div>
      </div>

      {/* Main cards */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Kontakt (fra avtale)</div>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Navn</div>
              <div className="font-medium">{adminName}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">E-post</div>
              <div className="font-medium">{adminEmail}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Telefon</div>
              <div className="font-medium">{phone}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Avtale (kort)</div>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Plan</div>
              <div className="font-medium">{planSummary}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Antall ansatte</div>
              <div className="font-medium">{Number.isFinite(employeeCount) ? String(employeeCount) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">Fakturering</div>
              <div className="font-medium">{billingLabel(invoiceCadenceRaw)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Days breakdown */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="border-b border-[rgb(var(--lp-border))] px-5 py-4">
          <div className="text-sm font-semibold">Leveringsdager (faktisk avtale)</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Viser valgt tier og pris per dag. Dette er grunnlaget for fakturering og drift.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/70 text-xs text-[rgb(var(--lp-muted))]">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-5 py-3">Dag</th>
                <th className="px-5 py-3">Tier</th>
                <th className="px-5 py-3">Pris eks. mva</th>
                <th className="px-5 py-3">Pris inkl. mva</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, idx) => (
                <tr
                  key={d.key}
                  className={[
                    "border-b border-[rgb(var(--lp-border))] last:border-b-0",
                    idx % 2 === 0 ? "bg-white/30" : "bg-white/10",
                  ].join(" ")}
                >
                  <td className="px-5 py-4 font-medium">{d.label}</td>
                  <td className="px-5 py-4">
                    <span className={["inline-flex rounded-full px-2.5 py-1 text-xs", tierPill(d.tier)].join(" ")}>
                      {tierLabel(d.tier)}
                    </span>
                  </td>
                  <td className="px-5 py-4">{formatNOK(d.price_ex_vat)}</td>
                  <td className="px-5 py-4">{formatNOK(d.price_inc_vat)}</td>
                  <td className="px-5 py-4 text-xs text-[rgb(var(--lp-muted))]">{d.enabled ? "Valgt" : "Ikke valgt"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Behandle registrering</div>
        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Pending kan kun endres av superadmin: Aktiver eller Avslå.
        </div>
        <Actions companyId={companyId} status={status} />
      </div>

      {/* ✅ Audit (per firma) */}
      <div className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Audit for firma</div>
        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Hendelser for dette firmaet (klikk en rad for detaljer).
        </div>

        <div className="mt-4">
          <AuditFeed companyId={companyId} initialLimit={200} title={undefined} />
        </div>
      </div>
    </div>
  );
}
