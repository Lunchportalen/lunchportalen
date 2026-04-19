// app/admin/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import "server-only";

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { loadCompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";
import CompanyOperationalBriefPanel from "@/components/admin/CompanyOperationalBriefPanel";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { formatDayMonthShortNO, formatWeekdayNO } from "@/lib/date/format";

import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, hasRole, type Role } from "@/lib/auth/roles";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";
import CommandCenterKpis from "@/components/admin/CommandCenterKpis";
import PendingInvitesStat from "@/components/admin/PendingInvitesStat";
import { getDesignSettings } from "@/lib/cms/design/getDesignSettings";
import { getOverlayBySlug } from "@/lib/cms/public/getOverlayByKey";
import { APP_OVERLAYS } from "@/lib/cms/overlays/registry";
import { renderOverlaySlot } from "@/lib/public/blocks/renderOverlaySlot";

/* =========================================================
   UI helpers
========================================================= */
function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type Health = "ok" | "warn" | "bad";

function HealthPill({ health }: { health: Health }) {
  const label = health === "ok" ? "Alt OK" : health === "warn" ? "Krever tiltak" : "Kritisk";
  const dotClass = health === "ok" ? "bg-emerald-500" : health === "warn" ? "bg-amber-500" : "bg-rose-500";
  const cls =
    health === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      : health === "warn"
      ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
      : "bg-rose-50 text-rose-900 ring-1 ring-rose-200";

  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", cls)}>
      <span className={cx("h-2 w-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

function StatusPill({ label }: { label: "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | string }) {
  const upper = String(label || "UNKNOWN").toUpperCase();
  const cls =
    upper === "ACTIVE"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      : upper === "PAUSED"
      ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
      : upper === "CLOSED"
      ? "bg-rose-50 text-rose-900 ring-1 ring-rose-200"
      : upper === "PENDING"
      ? "bg-neutral-50 text-neutral-800 ring-1 ring-black/10"
      : "bg-neutral-50 text-neutral-800 ring-1 ring-black/10";

  return <span className={cx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", cls)}>{upper}</span>;
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="lp-card lp-card--elevated">
      <div className="lp-card-pad">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm lp-muted">{subtitle}</p> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="lp-card">
      <div className="lp-card-pad">
        <div className="text-xs font-semibold text-neutral-600">{label}</div>
        <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value}</div>
        {hint ? <div className="mt-2 text-sm lp-muted">{hint}</div> : null}
      </div>
    </div>
  );
}

function QuietLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-start rounded-xl px-3 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-black/10 bg-white/70 hover:bg-white active:scale-[0.99]"
    >
      {children}
    </Link>
  );
}

function Divider() {
  return <div className="my-6 h-px w-full bg-black/10" />;
}

function isWeekday(iso: string) {
  // osloTodayISODate() is YYYY-MM-DD already Oslo-safe in your lib.
  // Use UTC noon to avoid DST edge weirdness.
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function nextDeliveryISO() {
  let d = osloTodayISODate();
  for (let i = 0; i < 7; i++) {
    if (isWeekday(d)) return d;
    d = addDaysISO(d, 1);
  }
  return d;
}

function formatShortDate(iso: string) {
  const weekday = formatWeekdayNO(iso);
  const short = formatDayMonthShortNO(iso);
  if (!weekday || !short) return iso;
  return `${weekday.slice(0, 3)} ${short}`;
}

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

/* =========================================================
   Page
========================================================= */
export default async function AdminCommandCenterPage() {
  // ✅ Hard gate: must be logged in + must be company_admin or superadmin
  {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) {
      // IMPORTANT: route via post-login eventually, but on SSR we send to login with next
      redirect("/login?next=/admin&code=NO_SESSION");
    }

    let profileRole: any = null;
    try {
      profileRole = await getRoleForUser(user.id);
    } catch {
      profileRole = null;
    }

    const role: Role = computeRole(user, profileRole);

    if (!hasRole(role, ["company_admin", "superadmin"])) {
      // Fail-closed: do not show admin surface
      redirect("/status?state=blocked&next=/admin&code=ROLE_FORBIDDEN");
    }
  }

  // ✅ Load admin context (fail-closed / blocked-state supported)
  const ctx = await loadAdminContext({
    nextPath: "/admin",
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
              buttonClassName="lp-btn lp-btn--secondary"
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

  // ✅ Safe computed values
  const companyName = ctx.company?.name ?? "Firma";
  const counts: any = ctx.counts ?? {};

  const operationalBrief = await loadCompanyOperationalBrief({
    companyId: ctx.companyId,
    locationId: ctx.profile?.location_id ?? null,
    companyStatusUpper: String(ctx.company?.status ?? "ACTIVE").toUpperCase(),
  });

  const employeesTotal = Number(counts.employeesTotal ?? 0);
  const employeesActive = Number(counts.employeesActive ?? 0);
  const employeesDisabled = Number(counts.employeesDisabled ?? 0);
  const locationsTotal = Number(counts.locationsTotal ?? 0);
  const ordersTodayActive = Number(counts.ordersTodayActive ?? 0);
  const ordersWeekActive = Number(counts.ordersWeekActive ?? 0);

  // Health is conservative (fail-closed mindset)
  const health: Health = employeesDisabled > 0 ? "warn" : "ok";

  // Next delivery
  const nextDelivery = nextDeliveryISO();
  const nextDeliveryLabel = employeesTotal > 0 ? formatShortDate(nextDelivery) : "—";
  const nextDeliveryHint =
    employeesTotal > 0 ? "Cut-off: kl. 08:00 (Europe/Oslo)." : "Legg inn ansatte for å aktivere drift.";

  // Primary action (ONE)
  const primaryHref = "/admin/orders";
  const primaryLabel = "Åpne ordreoversikt";

  const quickLinks = [
    { label: "Avtale", href: "/admin/agreement" },
    { label: "Ansatte", href: "/admin/people" },
    { label: "Lokasjoner", href: "/admin/locations" },
    { label: "Historikk", href: "/admin/history" },
    { label: "Insights", href: "/admin/insights" },
    { label: "Kontrolltårn", href: "/admin/control-tower" },
  ] as const;

  const companyStatus = String(ctx.companyStatus || ctx.company?.status || "ACTIVE").toUpperCase();

  const [overlay, designSettings] = await Promise.all([
    getOverlayBySlug(APP_OVERLAYS.companyAdmin.slug, { locale: "nb", environment: "prod" }),
    getDesignSettings(),
  ]);
  const topBanner = overlay.ok ? renderOverlaySlot(overlay.blocks, "topBanner", "prod", "nb", designSettings) : null;
  const headerSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "header", "prod", "nb", designSettings) : null;
  const helpSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "help", "prod", "nb", designSettings) : null;
  const footerCtaSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "footerCta", "prod", "nb", designSettings) : null;

  return (
    <AdminPageShell
      title="Oversikt"
      subtitle="Oversikt over avtalerammer og status — ikke operativ unntaksflate."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <HealthPill health={health} />
          <StatusPill label={companyStatus} />
        </div>
      }
    >
      {topBanner ? <div className="mb-3">{topBanner}</div> : null}
      {headerSlot ? <div className="mb-3">{headerSlot}</div> : null}
      <div className="mb-6">
        <CompanyOperationalBriefPanel brief={operationalBrief} />
      </div>
      {/* Row 1 — Header (1–3–1) */}
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide lp-muted">
            Firmaadmin · {companyName} · {ctx.profile?.location_id ? "Lokasjon valgt" : "Lokasjon ikke satt"}
          </div>
          <div className="mt-2 text-sm font-semibold text-neutral-900">
            Neste levering: {nextDeliveryLabel} <span className="lp-muted">•</span> {nextDeliveryHint}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={primaryHref} className="lp-btn lp-btn--primary lp-neon-focus lp-neon-glow-hover">
            {primaryLabel}
          </Link>
        </div>
      </div>

      {/* Row 2 — KPI cards (same kilde som loadAdminContext + /api/admin/dashboard-tall) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Ansatte"
          value={`${employeesActive} aktive`}
          hint={`${employeesTotal} totalt · ${employeesDisabled} deaktivert`}
        />
        <KpiCard label="Lokasjoner" value={String(locationsTotal)} hint="Registrerte lokasjoner i firmaet." />
        <KpiCard
          label="Neste leveringsvindu"
          value={nextDeliveryLabel}
          hint="Leveringsvindu fra avtale per lokasjon."
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Avtale (ledger)"
          value={operationalBrief.ledger_pipeline_label_nb}
          hint={
            operationalBrief.snapshot_agreement_status_upper
              ? `Snapshot: ${operationalBrief.snapshot_agreement_status_upper}`
              : "Ingen snapshot-rad (company_current_agreement)."
          }
        />
        <KpiCard
          label="Bestillinger i dag"
          value={String(ordersTodayActive)}
          hint="Aktive ordre i dag (Oslo-dato)."
        />
        <KpiCard
          label="Bestillinger denne uken"
          value={String(ordersWeekActive)}
          hint="Aktive ordre i inneværende uke (mandag–søndag-vindu som i dashboard-API)."
        />
      </div>

      {/* Row 3 — Main (8) + Side (4) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card
            title="Neste levering"
            subtitle="Ukesplan og bestillingsstatus (maks 2 uker)."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus">
                  Bestill lunsj
                </Link>
                <Link href="/admin/invite" className="lp-btn lp-btn--ghost">
                  Inviter ansatte
                </Link>
              </div>
            }
          >
            <CommandCenterKpis
              nextDeliveryLabel={employeesTotal > 0 ? `Neste levering · ${nextDeliveryLabel}` : "Ingen ansatte registrert ennå"}
              cutoffLabel="Cut-off: kl. 08:00 (Europe/Oslo)."
              employeesActive={employeesActive}
              employeesTotal={employeesTotal}
            />

            <Divider />

            <div className="text-sm lp-muted">
              <div className="font-semibold text-neutral-900">Systemregler</div>
              <ul className="mt-2 list-disc pl-5">
                <li>Avbestilling samme dag før kl. 08:00 (Europe/Oslo).</li>
                <li>Neste uke åpner torsdag kl. 08:00.</li>
                <li>Systemet er én sannhetskilde — ingen manuelle overstyringer.</li>
              </ul>
            </div>
          </Card>

          <Card title="Aktivitet" subtitle="Siste hendelser (vises når systemet har data å vise).">
            <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
              <div className="text-sm font-semibold text-neutral-900">Ingen aktivitet å vise</div>
              <p className="mt-1 text-sm lp-muted">
                Når bestillinger/avbestillinger og endringer logges, vil de vises her i en kort, driftstilpasset feed.
              </p>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card title="Systemstatus" subtitle="Dette er fasit akkurat nå.">
            <div className="space-y-3">
              <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-xs font-semibold text-neutral-600">Firma-status</div>
                <div className="mt-2">
                  <StatusPill label={companyStatus} />
                </div>
                <div className="mt-2 text-sm lp-muted">
                  Operativ sannhet fra systemet (lesbar). Endring av firmastatus skjer kun i superadmin-flyt — ikke her.
                </div>
              </div>

              <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-xs font-semibold text-neutral-600">Invitasjoner</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">Pending</div>
                  <PendingInvitesStat />
                </div>
                <div className="mt-2">
                  <Link href="/admin/invite" className="lp-btn lp-btn--secondary w-full">
                    Inviter ansatte
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-xs font-semibold text-neutral-600">Quick links</div>
                <div className="mt-2 grid gap-2">
                  {quickLinks.map((x) => (
                    <QuietLink key={x.href} href={x.href}>
                      {x.label}
                    </QuietLink>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Fakturagrunnlag" subtitle="CSV for økonomi — ferdig formatert.">
            <div className="flex flex-col gap-3">
              <Link href="/api/admin/invoices/csv" className="lp-btn lp-btn--secondary">
                Last ned (CSV)
              </Link>
              <div className="text-sm lp-muted">Historikk kan ikke endres.</div>
            </div>
          </Card>

          <Card title="Support" subtitle="Hvis noe ikke stemmer, send en rapport med én gang.">
            <div className="flex flex-col gap-3">
              <SupportReportButton
                reason="COMPANY_ADMIN_COMMAND_CENTER_SUPPORT_REPORT"
                companyId={ctx.companyId}
                locationId={ctx.profile?.location_id ?? null}
                buttonClassName="lp-btn lp-btn--secondary w-full"
              />
              <div className="text-sm lp-muted">
                Rapporten inkluderer firma, lokasjon og tidspunkt — så drift kan handle raskt.
              </div>
            </div>
          </Card>
        </div>
      </div>

      {helpSlot ? <div className="mt-6">{helpSlot}</div> : null}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <span>Dashboard 2.0 viser kun beslutningsverdi. Detaljer ligger på undersider.</span>
        <Link className="font-semibold text-neutral-700 hover:text-neutral-900" href="/week">
          Til ansattvisning →
        </Link>
      </div>
      {footerCtaSlot ? <div className="mt-6">{footerCtaSlot}</div> : null}
    </AdminPageShell>
  );
}
