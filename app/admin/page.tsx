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
import { loadDashboardCompanyMeta } from "@/lib/admin/loadDashboardCompanyMeta";
import { loadCompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";
import { getAgreementStatus } from "@/lib/auth/agreementStatus";
import { formatAgreementSystemLabel } from "@/lib/admin/agreementLabel";
import {
  buildDashboardActivity,
  buildDashboardKpis,
  buildDashboardRoster,
  buildDashboardSystemStatus,
  buildHeroHeading,
  buildHeroSubtext,
  buildOnboardingChecklist,
  buildReadinessStrip,
  formatDeliveryDaysLabel,
  formatProviderLabel,
  isOnboardingMode,
  resolveChartEmptyVariant,
  type DashboardBuildInput,
} from "@/lib/admin/dashboardOnboarding";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { supabaseServer } from "@/lib/supabase/server";
import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import KpiRow from "./page-sections/KpiRow";
import OrdersChart, { type OrdersChartPoint } from "./page-sections/OrdersChart";
import ActivityFeed from "./page-sections/ActivityFeed";
import TodayRoster from "./page-sections/TodayRoster";
import SystemStatus from "./page-sections/SystemStatus";
import CommandCenterHero from "./page-sections/CommandCenterHero";
import OnboardingActionPanel from "./page-sections/OnboardingActionPanel";
import ReadinessStrip from "./page-sections/ReadinessStrip";

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

export default async function AdminCommandCenterPage() {
  const auth = await getAuthContext();
  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
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

  const [operationalBrief, agreementStatus, companyMeta] = await Promise.all([
    loadCompanyOperationalBrief({
      companyId: ctx.companyId,
      locationId: ctx.profile?.location_id ?? null,
      companyStatusUpper: String(ctx.company?.status ?? "ACTIVE").toUpperCase(),
    }),
    getAgreementStatus(await supabaseServer(), ctx.companyId),
    loadDashboardCompanyMeta(ctx.companyId),
  ]);

  const employeesActive = safeNumber(counts.employeesActive);
  const employeesTotal = safeNumber(counts.employeesTotal);
  const ordersTodayActive = safeNumber(counts.ordersTodayActive);
  const ordersWeekActive = safeNumber(counts.ordersWeekActive);
  const orderCountToday = operationalBrief.orders_day.ok
    ? operationalBrief.orders_day.total_operative
    : ordersTodayActive;

  const companyName = String(ctx.company?.name ?? "").trim() || "Firma";
  const onboarding = isOnboardingMode(employeesActive);
  const agreementLabel = formatAgreementSystemLabel(agreementStatus);
  const providerLabel = formatProviderLabel(companyMeta.providerName);
  const deliveryDays = formatDeliveryDaysLabel(operationalBrief.operative_day_keys);

  const dashboardInput: DashboardBuildInput = {
    companyName,
    providerName: companyMeta.providerName,
    ehfEnabled: companyMeta.ehfEnabled,
    employeesActive,
    employeesTotal,
    ordersTodayActive,
    ordersWeekActive,
    orderCountToday,
    agreementStatus,
    operationalBrief,
  };

  const readinessItems = buildReadinessStrip(dashboardInput);
  const checklist = buildOnboardingChecklist({
    employeesActive,
    ordersWeekActive,
    orderCountToday,
    providerName: companyMeta.providerName,
  });
  const kpiData = buildDashboardKpis(dashboardInput);
  const activityItems = buildDashboardActivity(dashboardInput);
  const rosterItems = buildDashboardRoster(dashboardInput);
  const systemStatus = buildDashboardSystemStatus(dashboardInput);
  const chartEmptyVariant = resolveChartEmptyVariant({
    employeesActive,
    ordersWeekActive,
    orderCountToday,
  });
  const chartData = chartDataFromCounts(ordersWeekActive, orderCountToday);

  return (
    <div className="ds-admin-command-center">
      <CommandCenterHero
        heading={buildHeroHeading(companyName, onboarding)}
        subtext={buildHeroSubtext(onboarding)}
        agreementLabel={agreementLabel}
        providerLabel={providerLabel}
        deliveryDays={deliveryDays}
        onboarding={onboarding}
        orderCountToday={orderCountToday}
      />

      {onboarding ? <OnboardingActionPanel steps={checklist} /> : null}

      <ReadinessStrip items={readinessItems} />

      {!onboarding ? <KpiRow data={kpiData} /> : null}

      <div className="ds-admin-grid-2">
        <OrdersChart data={chartData} emptyVariant={chartEmptyVariant} />
        <ActivityFeed items={activityItems} />
      </div>

      <div className="ds-admin-grid-2 ds-admin-grid-2--equal">
        <TodayRoster items={rosterItems} />
        <SystemStatus data={systemStatus} />
      </div>
    </div>
  );
}
