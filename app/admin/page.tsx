// app/admin/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { formatDayMonthShortNO, formatWeekdayNO } from "@/lib/date/format";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CommandCenterKpis from "@/components/admin/CommandCenterKpis";
import PendingInvitesStat from "@/components/admin/PendingInvitesStat";

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
  const badgeClass =
    health === "ok"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : health === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-rose-50 text-rose-900 border-rose-200";
  return (
    <Badge className={cx("gap-2", badgeClass)}>
      <span className={cx("h-2 w-2 rounded-full", dotClass)} />
      {label}
    </Badge>
  );
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
    <section className="lp-card lp-card--elevated p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm lp-muted">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-black/10 transition hover:bg-white active:scale-[0.99]"
    >
      {children}
    </Link>
  );
}

function SecondaryButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="secondary" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function Divider() {
  return <div className="my-6 h-px w-full bg-black/10" />;
}

function isWeekday(iso: string) {
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
  return "Systemfeil";
}

function blockedBody(b: AdminContextBlocked) {
  if (b.blocked === "ACCOUNT_DISABLED") return "Kontoen er deaktivert og har ikke tilgang til administrasjon.";
  if (b.blocked === "MISSING_COMPANY_ID") return "Kontoen er registrert som company_admin, men mangler company_id.";
  if (b.blocked === "COMPANY_INACTIVE") return "Tilgang er begrenset fordi firma ikke er aktivt.";
  return "Vi klarte ikke å hente nødvendig oversikt akkurat nå.";
}

function blockedLevel(b: AdminContextBlocked): "followup" | "critical" {
  return b.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

/* =========================================================
   Page
========================================================= */
export default async function AdminCommandCenterPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  // Blocked / gated state
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

  // OK state
  const companyName = ctx.company?.name ?? "Firma";
  const counts = ctx.counts;

  /**
   * 10/10 health:
   * - ACTIVE er allerede gated
   * - warn hvis deaktiverte ansatte finnes
   */
  const health: Health = counts.employeesDisabled > 0 ? "warn" : "ok";

  /**
   * 10/10: ingen tomme KPI-er.
   * Vi viser konkrete sannheter som finnes nå, uten å fake data.
   */
  const nextDelivery = nextDeliveryISO();
  const nextDeliveryValue =
    counts.employeesTotal > 0 ? `Neste levering · ${formatShortDate(nextDelivery)}` : "Ingen ansatte registrert ennå";

  const nextDeliveryHint = "Cut-off: kl. 08:00 (Europe/Oslo).";

  /**
   * 10/10: ÉN primær handling.
   * Her: Ordreoversikt (fordi det er den mest beslutningskritiske flaten for admin).
   */
  const primaryHref = "/admin/orders";
  const primaryLabel = "Åpne ordreoversikt";
  const neonHref = "/week";
  const neonLabel = "Bestill lunsj";

  return (
    <AdminPageShell
      title="Command Center"
      subtitle="Kontroll, status og rammer — uten støy."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <HealthPill health={health} />
          <GhostLink href="/admin/agreement">Avtale</GhostLink>
          <GhostLink href="/admin/people">Ansatte</GhostLink>
          <GhostLink href="/admin/insights">Insights</GhostLink>
          <GhostLink href="/admin/history">Historikk</GhostLink>
          <GhostLink href="/admin/locations">Lokasjoner</GhostLink>
        </div>
      }
    >
      <div className="text-xs font-semibold tracking-wide lp-muted">
        Admin · {companyName} · {ctx.profile.location_id ? "Lokasjon valgt" : "Lokasjon ikke satt"}
      </div>

      <div className="mt-6">
        <Card
          title="Systemstatus"
          subtitle="Dette er fasit akkurat nå. Én sannhetskilde, ingen manuelle unntak."
          right={
            <Badge>ACTIVE</Badge>
          }
        >
          <CommandCenterKpis
            nextDeliveryLabel={nextDeliveryValue}
            cutoffLabel={nextDeliveryHint}
            employeesActive={counts.employeesActive}
            employeesTotal={counts.employeesTotal}
          />

          <Divider />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Neste handling</div>
              <div className="mt-1 text-sm lp-muted">
                Åpne ordreoversikt for å se status på kommende leveranser og rammer.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButtonLink href={primaryHref}>{primaryLabel}</SecondaryButtonLink>
              <SecondaryButtonLink href="/admin/invite">Inviter ansatte</SecondaryButtonLink>
              <GhostLink href="/api/admin/invoices/csv">Last ned fakturagrunnlag</GhostLink>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Ansatte"
            subtitle="Admin oppretter og vedlikeholder brukere. Ansatte bestiller/avbestiller selv innenfor rammer."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <GhostLink href="/admin/people">Åpne ansatte</GhostLink>
                <SecondaryButtonLink href="/admin/invite">Inviter</SecondaryButtonLink>
                <GhostLink href="/admin/invite">CSV bulk</GhostLink>
              </div>
            }
          >
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <form action="/admin/people" method="get" className="flex items-center gap-2">
                <input
                  name="q"
                  placeholder="Hurtig-søk navn, e-post"
                  className="w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-black/10 focus:outline-none"
                />
                <button className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-black/10">
                  Søk
                </button>
              </form>
              <div className="flex items-center justify-end gap-3 text-xs text-neutral-600">
                <PendingInvitesStat />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-xs font-semibold text-neutral-600">Totalt</div>
                <div className="mt-2 text-2xl font-extrabold text-neutral-900">{counts.employeesTotal}</div>
              </div>
              <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-xs font-semibold text-neutral-600">Aktive</div>
                <div className="mt-2 text-2xl font-extrabold text-neutral-900">{counts.employeesActive}</div>
              </div>
              <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-xs font-semibold text-neutral-600">Deaktivert</div>
                <div className="mt-2 text-2xl font-extrabold text-neutral-900">{counts.employeesDisabled}</div>
              </div>
            </div>

            {counts.employeesDisabled > 0 ? (
              <div className="mt-5 rounded-2xl bg-amber-50/70 p-4 ring-1 ring-amber-200/60">
                <div className="text-sm font-semibold text-neutral-900">Anbefaling</div>
                <p className="mt-1 text-sm text-neutral-700">
                  Du har deaktiverte ansatte. Hold listen ryddig for bedre kontroll og riktig tilgang.
                </p>
                <div className="mt-3">
                  <GhostLink href="/admin/people">Se ansatte</GhostLink>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
                <div className="text-sm font-semibold text-neutral-900">Alt ser ryddig ut</div>
                <p className="mt-1 text-sm lp-muted">Ingen deaktiverte ansatte akkurat nå.</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Min lunsj" subtitle="Bestill for deg selv. Cut-off 08:00 (Europe/Oslo).">
            <div className="flex flex-col gap-3">
              <Button asChild className="lp-neon-focus lp-neon-glow-hover">
                <Link href={neonHref}>{neonLabel}</Link>
              </Button>
              <div className="text-sm lp-muted">Avtalen styrer hvilke dager som er tilgjengelige.</div>
            </div>
          </Card>

          <Card title="Fakturagrunnlag" subtitle="CSV for økonomi — ferdig formatert.">
            <div className="flex flex-col gap-3">
              <Badge variant="outline">🔒 Låst</Badge>
              <SecondaryButtonLink href="/api/admin/invoices/csv">Last ned (CSV)</SecondaryButtonLink>
              <div className="text-sm lp-muted">Historikk kan ikke endres.</div>
            </div>
          </Card>

          <Card title="Support" subtitle="Hvis noe ikke stemmer, send en rapport med én gang.">
            <div className="flex flex-col gap-3">
              <SupportReportButton
                reason="COMPANY_ADMIN_COMMAND_CENTER_SUPPORT_REPORT"
                companyId={ctx.companyId}
                locationId={ctx.profile.location_id ?? null}
              />
              <div className="text-sm lp-muted">
                Rapporten inkluderer firma, lokasjon og tidspunkt — så drift kan handle raskt.
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
                  Vis teknisk info (kun ved behov)
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-2xl bg-neutral-950 p-4 text-xs text-white/85 ring-1 ring-black/10">
{JSON.stringify(
  {
    companyId: ctx.companyId,
    locationId: ctx.profile.location_id ?? null,
    companyStatus: ctx.companyStatus,
    authUserId: ctx.dbg.authUserId,
    authEmail: ctx.dbg.authEmail,
  },
  null,
  2
)}
                </pre>
              </details>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <span>Command Center viser kun beslutningsverdi. Detaljer ligger på undersider.</span>
        <Link className="font-semibold text-neutral-700 hover:text-neutral-900" href="/week">
          Til ansattvisning →
        </Link>
      </div>
    </AdminPageShell>
  );
}



