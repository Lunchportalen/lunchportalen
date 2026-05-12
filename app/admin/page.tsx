// app/admin/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import "server-only";

import { redirect } from "next/navigation";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { loadCompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";
import { getAgreementStatus } from "@/lib/auth/agreementStatus";
import { formatAgreementSystemLabel, formatSystemPaymentLabel } from "@/lib/admin/agreementLabel";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { supabaseServer } from "@/lib/supabase/server";
import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import KpiRow, { type AdminKpi } from "./page-sections/KpiRow";
import OrdersChart, { type OrdersChartPoint } from "./page-sections/OrdersChart";
import ActivityFeed, { type ActivityFeedItem } from "./page-sections/ActivityFeed";
import TodayRoster, { type TodayRosterItem } from "./page-sections/TodayRoster";
import SystemStatus, { type SystemStatusRow } from "./page-sections/SystemStatus";

/* =========================================================
   Mapping: blocked -> UI
========================================================= */
function blockedTitle(b: AdminContextBlocked) {
  if (b.blocked === "ACCOUNT_DISABLED") return "Konto er deaktivert";
  if (b.blocked === "MISSING_COMPANY_ID") return "Mangler firmatilknytning";
  if (b.blocked === "COMPANY_INACTIVE") return "Firma er ikke aktivt";
  if (b.blocked === "COUNTS_FAILED") return "Kunne ikke hente nøkkeltall";
  if (b.blocked === "FORBIDDEN") return "Ikke firmaadmin-flate for denne rollen";
  return "Systemfeil";
}

function blockedBody(b: AdminContextBlocked) {
  if (b.blocked === "ACCOUNT_DISABLED") return "Kontoen er deaktivert og har ikke tilgang til administrasjon.";
  if (b.blocked === "MISSING_COMPANY_ID") return "Kontoen er registrert som company_admin, men mangler company_id.";
  if (b.blocked === "COMPANY_INACTIVE") return "Tilgang er begrenset fordi firma ikke er aktivt.";
  if (b.blocked === "COUNTS_FAILED") return "Vi klarte ikke å hente nøkkeltall akkurat nå. Prøv igjen om litt.";
  if (b.blocked === "FORBIDDEN")
    return "/admin er firmaadmin-rammeflate (ett firma, operativ sannhet). System- og tverrfirmastyring skjer i superadmin — ikke her.";
  return "Vi klarte ikke å hente nødvendig oversikt akkurat nå.";
}

function blockedLevel(b: AdminContextBlocked): "followup" | "critical" {
  return b.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

function safeNumber(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function adoptionPercent(ordersToday: number, employeesActive: number) {
  if (employeesActive <= 0) return "0%";
  return `${Math.round((ordersToday / employeesActive) * 100)}%`;
}

function cutoffFoot(cutoff: string) {
  if (cutoff === "TODAY_LOCKED") return "Cut-off 08:00 passert";
  if (cutoff === "TODAY_OPEN") return "Cut-off kl. 08:00";
  if (cutoff === "FUTURE_OPEN") return "Fremtidig leveringsdag";
  return "Dagen er låst";
}

function daysLeftLabel(count: number) {
  if (count <= 0) return "Ingen leveringsdager igjen";
  if (count === 1) return "1 leveringsdag igjen";
  return `${count} leveringsdager igjen`;
}

function initials(value: string) {
  const parts = value
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.slice(0, 2) || "LP").toUpperCase();
}

function chartDataFromCounts(ordersWeekActive: number, ordersTodayActive: number): OrdersChartPoint[] {
  const base = Math.max(0, ordersWeekActive - ordersTodayActive);
  const soft = Math.floor(base / 4);
  return [
    { label: "MAN", value: soft },
    { label: "TIR", value: soft },
    { label: "ONS", value: soft },
    { label: "TOR", value: Math.max(0, base - soft * 3) },
    { label: "FRE", value: ordersTodayActive },
  ];
}

/* =========================================================
   Page
========================================================= */
export default async function AdminCommandCenterPage() {
  // Hard gate: must be logged in + must be company_admin or superadmin.
  const auth = await getAuthContext();
  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      // No `next=/admin`: /login auto-redirects authenticated users to their
      // role home, so adding next=/admin would create a /login ↔ /admin loop
      // when something downstream fails. `code` makes /login stay on the form.
      redirect("/login?code=NO_SESSION");
    }
    redirect("/status?state=blocked&next=/admin&code=AUTH_BLOCKED");
  }

  const role = auth.role;
  if (role !== "company_admin" && role !== "superadmin") {
    redirect("/status?state=blocked&next=/admin&code=ROLE_FORBIDDEN");
  }

  if (role === "superadmin" && !auth.company_id) {
    redirect("/superadmin");
  }

  // Load admin context (fail-closed / blocked-state supported)
  const ctx = await loadAdminContext({
    nextPath: "/admin",
    enforceCompanyAdmin: role !== "superadmin",
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="ds-admin-error">
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
              buttonClassName="ds-btn ds-btn--ghost"
            />
          }
          meta={[
            { label: "auth.user.id", value: ctx.dbg.authUserId },
            { label: "auth.user.email", value: ctx.dbg.authEmail || "Ikke tilgjengelig" },
            { label: "profile.company_id", value: ctx.companyId ?? "Ikke tilgjengelig" },
            { label: "profile.location_id", value: ctx.profile?.location_id ?? "Ikke tilgjengelig" },
            { label: "env.url", value: ctx.dbg.envSupabaseUrl ?? "Ikke tilgjengelig" },
            { label: "env.hasServiceKey", value: String(ctx.dbg.hasServiceKey) },
            ...(ctx.dbg.q_company
              ? [{ label: "company.err", value: ctx.dbg.q_company.error ?? "Ikke tilgjengelig" }]
              : []),
            ...(Object.entries(ctx.dbg.q_counts ?? {})
              .filter(([, v]) => v)
              .slice(0, 10)
              .map(([k, v]) => ({ label: `count.${k}`, value: String(v) }))),
          ]}
        />
      </div>
    );
  }

  const counts: any = ctx.counts ?? {};

  const operationalBrief = await loadCompanyOperationalBrief({
    companyId: ctx.companyId,
    locationId: ctx.profile?.location_id ?? null,
    companyStatusUpper: String(ctx.company?.status ?? "ACTIVE").toUpperCase(),
  });

  const agreementStatus = await getAgreementStatus(await supabaseServer(), ctx.companyId);
  const employeesTotal = safeNumber(counts.employeesTotal);
  const employeesActive = safeNumber(counts.employeesActive);
  const employeesDisabled = safeNumber(counts.employeesDisabled);
  const ordersTodayActive = safeNumber(counts.ordersTodayActive);
  const ordersWeekActive = safeNumber(counts.ordersWeekActive);
  const operativeDayCount = operationalBrief.operative_day_keys.length;
  const orderCountToday = operationalBrief.orders_day.ok ? operationalBrief.orders_day.total_operative : ordersTodayActive;

  const kpiData: AdminKpi[] = [
    {
      label: "Ansatte",
      value: String(employeesActive),
      foot: `${employeesDisabled} inaktive · ${employeesTotal} totalt`,
      trend: { label: "stabil", kind: "neutral" },
    },
    {
      label: "Bestillinger i dag",
      value: String(orderCountToday),
      foot: cutoffFoot(operationalBrief.cutoff_today),
    },
    {
      label: "Denne uken",
      value: String(ordersWeekActive),
      foot: daysLeftLabel(operativeDayCount),
    },
    {
      label: "Adopsjon",
      value: adoptionPercent(orderCountToday, employeesActive),
      foot: "Av aktive ansatte",
    },
  ];

  const chartData = chartDataFromCounts(ordersWeekActive, orderCountToday);
  const ordersDayError = operationalBrief.orders_day.ok === false ? operationalBrief.orders_day.message : null;
  const activityItems: ActivityFeedItem[] = [
    {
      text: operationalBrief.orders_day.ok
        ? `${operationalBrief.orders_day.total_operative} operative ordre i dag`
        : `Ordrelesing feilet: ${ordersDayError ?? "Ukjent feil"}`,
      time: "I dag",
      kind: operationalBrief.orders_day.ok ? "success" : "accent",
    },
    {
      text: operationalBrief.ledger_pipeline_label_nb,
      time: "Avtale",
      kind: agreementStatus.isActive ? "success" : "soft",
    },
    {
      text: operationalBrief.booking_detail_lines_nb[0] ?? "Driftsgrunnlaget er lest uten ekstra merknader",
      time: "Bestilling",
      kind: operationalBrief.booking_today === "open" ? "success" : "soft",
    },
  ];

  const rosterItems: TodayRosterItem[] = operationalBrief.orders_day.ok
    ? operationalBrief.orders_day.by_location.slice(0, 5).map((row) => ({
        name: row.location_label,
        meta: `${row.count} ordre · ${operationalBrief.ledger_delivery_window_nb ?? "leveringsvindu fra avtale"}`,
        status: "OK",
        statusKind: "ok",
        initials: initials(row.location_label),
      }))
    : [];

  if (rosterItems.length === 0) {
    rosterItems.push({
      name: "Ingen operative ordre",
      meta: operationalBrief.orders_day.ok ? "Ingen ordre funnet for firmaet i dag" : ordersDayError ?? "Ukjent feil",
      status: "Rolig",
      statusKind: "warn",
      initials: "LP",
    });
  }

  const systemStatus: SystemStatusRow[] = [
    {
      label: "Avtale",
      value: formatAgreementSystemLabel(agreementStatus),
      kind: agreementStatus.isActive ? "ok" : "warn",
    },
    {
      label: "Neste levering",
      value: operationalBrief.operative_days_label_nb || "Ikke satt",
      kind: operationalBrief.operative_day_keys.length ? "ok" : "warn",
    },
    {
      label: "Cut-off i dag",
      value: cutoffFoot(operationalBrief.cutoff_today),
      kind: operationalBrief.cutoff_today === "TODAY_LOCKED" ? "warn" : "ok",
    },
    {
      label: "Betaling",
      // TODO: company_billing_accounts-tabellen er ikke en del av prod-DB ennå.
      // Faktura-status koblet til invoices/invoice_runs/tripletex_invoices kommer i senere fase.
      // Inntil da viser SystemStatus en nøytral "Ikke aktivert"-status.
      // agreementStatus.billingHold brukes ikke i denne raden før ekte billing-kilde er koblet.
      value: formatSystemPaymentLabel(),
      kind: "neutral",
    },
    {
      label: "Invitasjoner",
      value: "Se Ansatte",
      kind: "ok",
    },
  ];

  return (
    <>
      <KpiRow data={kpiData} />
      <div className="ds-admin-grid-2">
        <OrdersChart data={chartData} />
        <ActivityFeed items={activityItems} />
      </div>
      <div className="ds-admin-grid-2 ds-admin-grid-2--equal">
        <TodayRoster items={rosterItems} />
        <SystemStatus data={systemStatus} />
      </div>
    </>
  );
}
