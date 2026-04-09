// app/admin/agreement/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { headers } from "next/headers";
import { Suspense } from "react";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
  type AdminContextOk,
} from "@/lib/admin/loadAdminContext";
import { formatDateNO, formatDateTimeNO } from "@/lib/date/format";
import type { AgreementPageData, DayKey } from "@/lib/admin/agreement/types";
import { ADMIN_DASHBOARD_HREF } from "@/lib/admin/constants";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminCompanySelect from "@/components/admin/AdminCompanySelect";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AgreementFetchResult =
  | { kind: "ok"; data: AgreementPageData; rid: string }
  | { kind: "error"; message: string; rid: string; errorCode?: string | null };

type HeaderLike = { get(name: string): string | null };

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Man",
  tue: "Tir",
  wed: "Ons",
  thu: "Tor",
  fri: "Fre",
};

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

function makeRid(prefix = "admin_agreement") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOriginFromHeaders(h: HeaderLike) {
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]?.trim();
  return host ? `${proto}://${host}` : "";
}

function formatDate(value: string | null) {
  if (!value) return "Ukjent";
  return formatDateNO(value);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "—";
  return formatDateTimeNO(value);
}

function formatPriceExVat(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "Ikke tilgjengelig";
  const n = Math.round(value);
  return `${new Intl.NumberFormat("nb-NO").format(n)} kr eks. mva.`;
}

function formatTierLabel(value: AgreementPageData["pricing"]["planTier"]) {
  if (!value) return "Ikke tilgjengelig";
  return value === "LUXUS" ? "Luxus" : "Basis";
}

function statusBadge(status: AgreementPageData["status"]) {
  if (status === "ACTIVE") return { label: "AKTIV", variant: "active" as const };
  if (status === "PAUSED") return { label: "PAUSET", variant: "warning" as const };
  if (status === "CLOSED") return { label: "AVSLUTTET", variant: "danger" as const };
  if (status === "MISSING_AGREEMENT") return { label: "MANGLER AVTALE", variant: "info" as const };
  return { label: "FIRMA DEAKTIVERT", variant: "danger" as const };
}

function statusNote(status: AgreementPageData["status"]) {
  if (status === "PAUSED") return "Avtalen er pauset. Visningen er skrivebeskyttet.";
  if (status === "CLOSED") return "Avtalen er avsluttet. Visningen er skrivebeskyttet.";
  if (status === "MISSING_AGREEMENT") return "Firmaet mangler aktiv avtale. Visningen er skrivebeskyttet.";
  if (status === "COMPANY_DISABLED") return "Firmaet er deaktivert. Visningen er skrivebeskyttet.";
  return "Skrivebeskyttet visning for firmaadmin.";
}

function statValue(v: number | null) {
  return v == null ? "Ikke tilgjengelig" : String(v);
}

async function fetchAgreementServer(companyId?: string | null): Promise<AgreementFetchResult> {
  const h = await headers();
  const rid = makeRid();
  const origin = getOriginFromHeaders(h as unknown as HeaderLike);
  const cookieHeader = h.get("cookie") ?? "";

  // GET /api/admin/agreement — canonical AgreementPageData (jsonOk { data })
  const companyParam = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const fetchUrl = `${origin}/api/admin/agreement${companyParam}`;

  try {
    const res = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
        "x-rid": rid,
      },
    });

    const json = await res.json().catch(() => null);
    const responseRid = String(json?.rid ?? rid);

    if (!json || json.ok !== true) {
      return {
        kind: "error",
        message: json?.message ?? "Kunne ikke hente avtalen. Prøv igjen.",
        rid: responseRid,
        errorCode: json?.error ?? "API_ERROR",
      };
    }

    return { kind: "ok", data: json.data as AgreementPageData, rid: responseRid };
  } catch {
    return { kind: "error", message: "Kunne ikke hente avtalen. Prøv igjen.", rid, errorCode: "FETCH_FAILED" };
  }
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="text-base font-semibold text-[rgb(var(--lp-text))]">{value}</div>
    </div>
  );
}

function DayStrip({ data }: { data: AgreementPageData }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {DAY_KEYS.map((dayKey) => {
        const day = data.weekPlan.find((d) => d.dayKey === dayKey);
        const hasTier = Boolean(day?.tier);
        return (
          <div key={dayKey} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2">
            <div className="text-xs font-semibold text-[rgb(var(--lp-text))]">{day?.label ?? DAY_LABELS[dayKey]}</div>
            <div className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
              {hasTier ? (day?.tier === "LUXUS" ? "Luxus" : "Basis") : "Ikke i avtalen"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekPreview({ data }: { data: AgreementPageData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {DAY_KEYS.map((dayKey) => {
        const day = data.weekPlan.find((d) => d.dayKey === dayKey);
        const active = Boolean(day?.active);
        return (
          <div
            key={dayKey}
            className={[
              "rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 px-4 py-3",
              active ? "" : "opacity-70",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">{day?.label ?? DAY_LABELS[dayKey]}</div>
              <Badge variant={active ? "active" : "outline"}>{active ? "Aktiv" : "Ikke aktiv"}</Badge>
            </div>
            <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
              {day?.tier ? (day.tier === "LUXUS" ? "Luxus" : "Basis") : "Ikke i avtalen"}
            </div>
            {active ? null : day?.reasonIfInactive ? (
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{day.reasonIfInactive}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AgreementLoading() {
  return (
    <Card className="p-6">
      <div className="text-sm text-[rgb(var(--lp-muted))]">Henter avtale ...</div>
    </Card>
  );
}

function AgreementError({ message, rid, errorCode }: { message: string; rid: string; errorCode?: string | null }) {
  return (
    <Card className="p-6">
      <div className="text-sm text-[rgb(var(--lp-muted))]">{message || "Kunne ikke hente avtalen. Prøv igjen."}</div>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.12em] text-[rgb(var(--lp-muted))]">
        <span>Årsak: {errorCode ?? "UKJENT"}</span>
        <span>RID: {rid || "—"}</span>
      </div>
    </Card>
  );
}

function AgreementBody({ ctx, data }: { ctx: AdminContextOk; data: AgreementPageData }) {
  const status = statusBadge(data.status);
  const note = statusNote(data.status);
  const updatedAt = formatUpdatedAt(data.updatedAt);
  const endDateLabel = data.binding.endDate ? formatDate(data.binding.endDate) : "Løpende";
  const remainingLabel = data.binding.endDate ? `${data.binding.remainingDays ?? 0} dager` : "—";

  return (
    <div className="grid gap-6">
      <Card variant="soft" className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold text-[rgb(var(--lp-text))]">Avtale</div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Cut-off 08:00 (Europe/Oslo)</div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <AdminCompanySelect companies={data.companies} selectedId={data.company.id} />
          <div className="text-xs text-[rgb(var(--lp-muted))]">Sist oppdatert {updatedAt}</div>
        </div>
        <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">{note}</div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="lp-h2">Avtalesammendrag</h2>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Systemfasit og leveringsdager.</div>
          </div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Kilde: company_current_agreement</div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Plan og pris</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-text))]">Tier: {formatTierLabel(data.pricing.planTier)}</div>
            <div className="text-sm text-[rgb(var(--lp-text))]">
              Pris per dag: {formatPriceExVat(data.pricing.pricePerCuvertNok)}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Binding</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-text))]">Start: {formatDate(data.binding.startDate)}</div>
            <div className="text-sm text-[rgb(var(--lp-text))]">Slutt: {endDateLabel}</div>
            <div className="text-sm text-[rgb(var(--lp-text))]">Gjenstår: {remainingLabel}</div>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Leveringsdager</div>
            <div className="mt-2">
              <DayStrip data={data} />
            </div>
          </div>
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">
            Kilde til sannhet
          </summary>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            Firma-ID: {data.sourceOfTruth.companyId} · Avtale-ID: {data.sourceOfTruth.agreementId ?? "-"} · Sist oppdatert:{" "}
            {formatUpdatedAt(data.sourceOfTruth.updatedAt)}
          </div>
          <div className="mt-2 text-[11px] text-[rgb(var(--lp-muted))]">Dashboard: {ADMIN_DASHBOARD_HREF}</div>
        </details>
      </Card>

      <Card className="p-6">
        <div className="mb-3">
          <h2 className="lp-h2">Oppsigelse og fornyelse</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Automatisk e-post/påminnelse (f.eks. tre måneder før binding utløper) er ikke aktivert som egen kjørende tjeneste ennå.
            Tallene under kommer fra avtaleregistrering når de finnes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Registrerte vilkår</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-text))]">
              Bindingstid:{" "}
              {data.terms?.bindingMonths != null ? `${data.terms.bindingMonths} måneder` : "Ikke tilgjengelig i data"}
            </div>
            <div className="mt-1 text-sm text-[rgb(var(--lp-text))]">
              Oppsigelsesfrist:{" "}
              {data.terms?.noticeMonths != null ? `${data.terms.noticeMonths} måneder` : "Ikke tilgjengelig i data"}
            </div>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-neutral-50/80 p-4 text-sm text-[rgb(var(--lp-text))]">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Viktig</div>
            <p className="mt-2 text-sm leading-relaxed">
              Oppsigelse og fornyelse styres av avtale og norsk avtalerett. For formelle steg, kontakt kundeteam eller bruk
              supportrapport. Ingen endring av avtale gjøres herfra uten superadmin/prosess.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="lp-h2">Operativt overblikk</h2>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ukevisning og driftstall (read-only).</div>
          </div>
          <SupportReportButton
            reason="ADMIN_AGREEMENT_REPORT"
            companyId={data.company.id}
            locationId={ctx.profile.location_id ?? null}
            agreementId={data.sourceOfTruth.agreementId ?? null}
            extra={{
              status: data.status,
              updatedAt: data.updatedAt,
              metrics: data.metrics,
              companyName: data.company.name ?? null,
            }}
            buttonLabel="Send systemrapport"
            buttonClassName="lp-btn lp-btn--primary lp-neon-focus lp-neon-glow-hover"
          />
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Dette er det ansatte ser</div>
          <div className="mt-3">
            <WeekPreview data={data} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatItem label="Ansatte totalt" value={statValue(data.metrics.employeesTotal)} />
          <StatItem label="Ansatte aktive" value={statValue(data.metrics.employeesActive)} />
          <StatItem label="Ansatte deaktivert" value={statValue(data.metrics.employeesDeactivated)} />
          <StatItem label="Avbestillinger før 08:00 (7d)" value={statValue(data.metrics.cancelsBeforeCutoff7d)} />
          <StatItem label="Bestillinger i dag" value={statValue(data.metrics.ordersToday)} />
        </div>
      </Card>
    </div>
  );
}

function blockedTitle(ctx: AdminContextBlocked) {
  if (ctx.blocked === "ACCOUNT_DISABLED") return "Konto er deaktivert";
  if (ctx.blocked === "MISSING_COMPANY_ID") return "Mangler firmatilknytning";
  if (ctx.blocked === "COMPANY_INACTIVE") return "Firma er ikke aktivt";
  return "Systemfeil";
}

function blockedBody(ctx: AdminContextBlocked) {
  if (ctx.blocked === "ACCOUNT_DISABLED") return "Kontoen er deaktivert og har ikke tilgang til administrasjon.";
  if (ctx.blocked === "MISSING_COMPANY_ID") return "Kontoen er registrert som company_admin, men mangler company_id.";
  if (ctx.blocked === "COMPANY_INACTIVE") return "Tilgang er begrenset fordi firma ikke er aktivt.";
  return "Vi klarte ikke å hente nødvendig kontekst akkurat nå.";
}

function blockedLevel(ctx: AdminContextBlocked): "followup" | "critical" {
  return ctx.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { companyId?: string | string[] | null };
}) {
  const ctx = await loadAdminContext({
    nextPath: "/admin/agreement",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <BlockedState
          level={blockedLevel(ctx)}
          title={blockedTitle(ctx)}
          body={blockedBody(ctx)}
          nextSteps={ctx.nextSteps}
          action={
            <SupportReportButton
              reason={ctx.support.reason}
              companyId={ctx.support.companyId}
              locationId={ctx.support.locationId}
              buttonLabel="Send systemrapport"
              buttonClassName="lp-btn lp-btn--secondary"
            />
          }
          meta={[
            { label: "auth.user.id", value: ctx.dbg.authUserId },
            { label: "auth.user.email", value: ctx.dbg.authEmail || "-" },
            { label: "company_id", value: ctx.companyId ?? "-" },
          ]}
        />
      </div>
    );
  }

  const companyIdParam = Array.isArray(searchParams?.companyId)
    ? searchParams?.companyId?.[0] ?? null
    : searchParams?.companyId ?? null;

  const result = await fetchAgreementServer(companyIdParam);

  return (
    <AdminPageShell title="Avtale" subtitle="Systemfasit for avtale, levering og kontroll." actions={null}>
      <Suspense fallback={<AgreementLoading />}>
        {result.kind === "error" ? (
          <AgreementError message={result.message} rid={result.rid} errorCode={result.errorCode ?? "API_ERROR"} />
        ) : (
          <AgreementBody ctx={ctx} data={result.data} />
        )}
      </Suspense>
    </AdminPageShell>
  );
}
