// app/superadmin/companies/[companyId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { formatDateTimeNO } from "@/lib/date/format";
import AuditCompanyPanel from "@/components/audit/AuditCompanyPanel";
import ArchivePanel from "./ArchivePanel";
import InvoiceBasisPanel from "./InvoiceBasisPanel";
import EsgSummaryPanel from "./EsgSummaryPanel";
import AgreementCard from "./AgreementCard";

type CompanyStatus = "active" | "paused" | "closed" | "pending";

type CompanyDetails = {
  company: {
    id: string;
    name: string | null;
    orgnr: string | null;
    status: CompanyStatus;
    updated_at: string | null;
    created_at: string | null;
    deleted_at: string | null;
  };
  agreement: null | {
    id: string;
    status: string;
    tier: "BASIS" | "LUXUS" | null;
    delivery_days: string[];
    starts_at: string | null;
    slot_start: string | null;
    slot_end: string | null;
    updated_at: string | null;
  };
  employees: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    is_active: boolean | null;
    deleted_at: string | null;
    last_seen_at: string | null;
  }>;
  locations: Array<{
    id: string;
    name: string | null;
    address_line: string | null;
    postnr: string | null;
    city: string | null;
    slot: string | null;
  }>;
  kpi?: {
    orders_30d: number;
    delivered_30d: number;
    cancel_30d: number;
  };
};

type ApiOk = { ok: true; rid: string; data: CompanyDetails };
type ApiErr = {
  ok: false;
  rid?: string;
  error: string;
  message?: string;
  status?: number;
  detail?: any;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "Ukjent firma";
}

function statusLabel(status: CompanyStatus) {
  if (status === "active") return "Aktiv";
  if (status === "paused") return "Pauset";
  if (status === "closed") return "Stengt";
  return "Venter";
}

function statusPill(status: CompanyStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (status === "paused") return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
  if (status === "closed") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

function formatISO(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return formatDateTimeNO(iso);
  } catch {
    return String(iso);
  }
}

function normalizeTier(raw: unknown): "BASIS" | "LUXUS" | null {
  const t = safeStr(raw).toUpperCase();
  if (t === "BASIS" || t === "LUXUS") return t;
  return null;
}

function normalizeDeliveryDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => safeStr(v).toUpperCase())
    .filter((v) => v === "MON" || v === "TUE" || v === "WED" || v === "THU" || v === "FRI");
}

function normalizeAgreement(raw: any): CompanyDetails["agreement"] {
  if (!raw || typeof raw !== "object") return null;

  const id = safeStr(raw.id ?? raw.agreementId);
  if (!id) return null;

  const daysSource = Array.isArray(raw.delivery_days)
    ? raw.delivery_days
    : Array.isArray(raw.days)
    ? raw.days
    : [];

  return {
    id,
    status: safeStr(raw.status).toUpperCase() || "UKJENT",
    tier: normalizeTier(raw.tier),
    delivery_days: normalizeDeliveryDays(daysSource),
    starts_at: safeStr(raw.starts_at ?? raw.start_date) || null,
    slot_start: safeStr(raw.slot_start) || null,
    slot_end: safeStr(raw.slot_end) || null,
    updated_at: safeStr(raw.updated_at) || null,
  };
}

function normalizeCompanyDetails(raw: any): CompanyDetails {
  const companyRaw = raw?.company ?? {};
  const employeesRaw = Array.isArray(raw?.employees) ? raw.employees : [];
  const locationsRaw = Array.isArray(raw?.locations) ? raw.locations : [];

  return {
    company: {
      id: safeStr(companyRaw.id),
      name: safeStr(companyRaw.name) || null,
      orgnr: safeStr(companyRaw.orgnr) || null,
      status: (() => {
        const s = safeStr(companyRaw.status).toLowerCase();
        return s === "active" || s === "paused" || s === "closed" || s === "pending"
          ? (s as CompanyStatus)
          : "pending";
      })(),
      updated_at: safeStr(companyRaw.updated_at) || null,
      created_at: safeStr(companyRaw.created_at) || null,
      deleted_at: null,
    },
    agreement: normalizeAgreement(raw?.agreement),
    employees: employeesRaw.map((e: any) => ({
      id: safeStr(e?.id),
      name: safeStr(e?.name) || null,
      email: safeStr(e?.email) || null,
      role: safeStr(e?.role) || null,
      is_active: typeof e?.is_active === "boolean" ? e.is_active : typeof e?.active === "boolean" ? e.active : null,
      deleted_at: safeStr(e?.deleted_at) || null,
      last_seen_at: safeStr(e?.last_seen_at) || null,
    })),
    locations: locationsRaw.map((l: any) => ({
      id: safeStr(l?.id),
      name: safeStr(l?.name) || null,
      address_line: safeStr(l?.address_line ?? l?.address) || null,
      postnr: safeStr(l?.postnr) || null,
      city: safeStr(l?.city) || null,
      slot: safeStr(l?.slot) || null,
    })),
    kpi: undefined,
  };
}

function roleLabel(role: string | null) {
  const s = safeStr(role).toLowerCase();
  if (s === "employee") return "Ansatt";
  if (s === "company_admin") return "Firma-admin";
  if (s === "superadmin") return "Superadmin";
  if (s === "driver") return "Sjåfør";
  if (s === "kitchen") return "Kjøkken";
  return "—";
}

function employeeStatus(e: CompanyDetails["employees"][number]) {
  if (e.deleted_at) return "Slettet";
  if (e.is_active === false) return "Deaktivert";
  return "Aktiv";
}

async function getBaseUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
  if (!host) return env;

  return `${proto}://${host}`.replace(/\/$/, "");
}

async function fetchCompanyDetails(companyId: string): Promise<ApiOk | ApiErr> {
  const c = await cookies();
  const base = await getBaseUrl();

  const cookieHeader = c
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const res = await fetch(`${base}/api/superadmin/companies/${encodeURIComponent(companyId)}`, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
      "Cache-Control": "no-store",
    },
  }).catch(() => null);

  if (!res) {
    return {
      ok: false,
      error: "FETCH_FAILED",
      message: "Kunne ikke kontakte API.",
    };
  }

  const text = await res.text();
  if (!text) {
    return {
      ok: false,
      error: "EMPTY_RESPONSE",
      message: `Tom respons (HTTP ${res.status})`,
      status: res.status,
    };
  }

  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "INVALID_JSON",
      message: `Ugyldig JSON (HTTP ${res.status})`,
      status: res.status,
    };
  }

  if (json?.ok === true) {
    return {
      ok: true,
      rid: safeStr(json?.rid),
      data: normalizeCompanyDetails(json?.data),
    } as ApiOk;
  }

  return {
    ok: false,
    rid: json?.rid,
    error: json?.error || "HTTP_ERROR",
    message: json?.message || `HTTP ${res.status}`,
    status: res.status,
    detail: json?.detail ?? null,
  };
}

export default async function SuperadminCompanyDetailPage(props: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const p = await props.params;
  const companyId = safeStr(p?.companyId);
  if (!companyId) notFound();

  const res = await fetchCompanyDetails(companyId);

  if (!res || (res as any).ok !== true) {
    const err = res as ApiErr;
    return (
      <main className="lp-select-text mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Firmadetaljer</h1>
            <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente firmadata.</p>
          </div>
          <Link
            href="/superadmin/companies"
            className="inline-flex rounded-2xl border bg-white px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Til firmaoversikt
          </Link>
        </header>

        <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold text-red-700">Feil ved henting</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            {err.message || "Ukjent feil."} {err.rid ? <span className="ml-2 text-xs">rid: {err.rid}</span> : null}
          </div>
        </section>
      </main>
    );
  }

  const ok = res as ApiOk;
  const data = ok.data;
  const company = data.company;
  const employees = Array.isArray(data.employees) ? data.employees : [];
  const locations = Array.isArray(data.locations) ? data.locations : [];
  const employeesCount = employees.filter((e) => safeStr(e.role).toLowerCase() === "employee").length;
  const adminsCount = employees.filter((e) => safeStr(e.role).toLowerCase() === "company_admin").length;

  return (
    <main className="lp-select-text mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin / Firma</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{safeName(company?.name)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Org.nr: {company?.orgnr ?? "—"}
            </span>
            <span className={["inline-flex rounded-full px-3 py-1 text-xs", statusPill(company.status)].join(" ")}>
              {statusLabel(company.status)}
            </span>
          </div>
        </div>

        <Link
          href="/superadmin/companies"
          className="inline-flex rounded-2xl border bg-white px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Til firmaoversikt
        </Link>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Ansatte</div>
          <div className="mt-2 text-2xl font-semibold">{employeesCount}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Firma-admins: {adminsCount}</div>
        </div>
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Lokasjoner</div>
          <div className="mt-2 text-2xl font-semibold">{locations.length}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Aktive leveringspunkter</div>
        </div>
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Sist endret</div>
          <div className="mt-2 text-lg font-semibold">{formatISO(company?.updated_at)}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Opprettet: {formatISO(company?.created_at)}</div>
        </div>
      </section>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <a href="#firma" className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50">
          Firma
        </a>
        <a href="#okonomi" className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50">
          Økonomi
        </a>
        <a href="#fakturagrunnlag" className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50">
          Fakturagrunnlag
        </a>
        <a href="#esg" className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50">
          ESG
        </a>
        <a href="#ansatte" className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50">
          Ansatte
        </a>
        <a href="#audit" className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-neutral-50">
          Audit
        </a>
      </nav>

      <section id="firma" className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Firma</div>
        <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Firmanavn</div>
            <div className="font-medium">{safeName(company?.name)}</div>
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Org.nr</div>
            <div className="font-medium">{company?.orgnr ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Status</div>
            <div className="font-medium">{statusLabel(company.status)}</div>
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Firma-ID</div>
            <div className="font-mono text-xs">{company?.id}</div>
          </div>
        </div>
      </section>

      <section id="okonomi" className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <AgreementCard companyId={companyId} initialAgreement={data.agreement} />
      </section>

      <section id="fakturagrunnlag" className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Fakturagrunnlag</div>
        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Historisk grunnlag (read-only).</div>
        <div className="mt-4">
          <InvoiceBasisPanel companyId={companyId} />
        </div>
      </section>

      <section id="esg" className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">ESG</div>
        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Basert på faktisk ordredata.</div>
        <div className="mt-4">
          <EsgSummaryPanel companyId={companyId} />
        </div>
      </section>

      <section id="ansatte" className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Ansatte</div>
        <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Total: {employees.length}</div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-[rgb(var(--lp-muted))]">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-4 py-2">Navn</th>
                <th className="px-4 py-2">Rolle</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Sist sett</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-sm text-[rgb(var(--lp-muted))]">
                    Ingen ansatte funnet.
                  </td>
                </tr>
              ) : (
                employees.map((e, idx) => (
                  <tr
                    key={e.id}
                    className={[
                      "border-b border-[rgb(var(--lp-border))] last:border-b-0",
                      idx % 2 === 0 ? "bg-white/30" : "bg-white/10",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.name ?? "—"}</div>
                      <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{e.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{roleLabel(e.role)}</td>
                    <td className="px-4 py-3 text-xs">{employeeStatus(e)}</td>
                    <td className="px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">{formatISO(e.last_seen_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="audit" className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Audit</div>
        <div className="mt-4">
          <AuditCompanyPanel companyId={companyId} />
        </div>
      </section>
      <ArchivePanel
        companyId={companyId}
        companyName={company?.name ?? null}
        companyOrgnr={company?.orgnr ?? null}
        companyStatus={company?.status ?? null}
        companyDeletedAt={company?.deleted_at ?? null}
      />
    </main>
  );
}











