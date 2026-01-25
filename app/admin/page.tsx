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

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";

/* =========================================================
   UI helpers
========================================================= */
function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type Health = "ok" | "warn" | "bad";

function HealthPill({ health }: { health: Health }) {
  const label = health === "ok" ? "Alt OK" : health === "warn" ? "Krever tiltak" : "Kritisk";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1",
        health === "ok" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
        health === "warn" && "bg-amber-50 text-amber-900 ring-amber-200",
        health === "bad" && "bg-rose-50 text-rose-900 ring-rose-200"
      )}
    >
      <span
        className={cx(
          "h-2 w-2 rounded-full",
          health === "ok" && "bg-emerald-500",
          health === "warn" && "bg-amber-500",
          health === "bad" && "bg-rose-500"
        )}
      />
      {label}
    </span>
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
    <section className="rounded-3xl bg-white/80 p-6 ring-1 ring-black/5 shadow-[0_12px_44px_-34px_rgba(0,0,0,.40)] backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const Inner = (
    <div className="group rounded-2xl bg-neutral-50/70 p-5 ring-1 ring-black/5 transition hover:bg-white hover:shadow-[0_12px_38px_-30px_rgba(0,0,0,.45)]">
      <div className="text-xs font-semibold tracking-wide text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value}</div>
      {hint ? <div className="mt-2 text-sm text-neutral-600">{hint}</div> : null}
      {href ? (
        <div className="mt-4 text-sm font-semibold text-neutral-900 opacity-80 group-hover:opacity-100">
          Se detaljer →
        </div>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {Inner}
    </Link>
  ) : (
    Inner
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

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
    >
      {children}
    </Link>
  );
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
      <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(176,139,87,.20),transparent),radial-gradient(1000px_600px_at_100%_10%,rgba(16,185,129,.12),transparent)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
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
              />
            }
            meta={[
              { label: "auth.user.id", value: ctx.dbg.authUserId },
              { label: "auth.user.email", value: ctx.dbg.authEmail || "—" },
              { label: "profile.company_id", value: ctx.companyId ?? "—" },
              { label: "profile.location_id", value: ctx.profile?.location_id ?? "—" },
              { label: "env.url", value: ctx.dbg.envSupabaseUrl ?? "—" },
              { label: "env.hasServiceKey", value: String(ctx.dbg.hasServiceKey) },
              ...(ctx.dbg.q_company ? [{ label: "company.err", value: ctx.dbg.q_company.error ?? "—" }] : []),
              ...(Object.entries(ctx.dbg.q_counts ?? {})
                .filter(([, v]) => v)
                .slice(0, 10)
                .map(([k, v]) => ({ label: `count.${k}`, value: String(v) }))),
            ]}
          />
        </div>
      </main>
    );
  }

  // OK state
  const companyName = ctx.company?.name ?? "Firma";
  const counts = ctx.counts;

  /**
   * Health heuristics (rolig, ikke støy):
   * - Hvis firma er ACTIVE (allerede gated), så er vi "ok".
   * - Hvis ansatteDisabled er høyt, kan vi vurdere "warn" (valgfritt).
   */
  const health: Health = counts.employeesDisabled > 0 ? "warn" : "ok";

  // KPI placeholders (til du har API / data)
  const nextDeliveryLabel = "I morgen";
  const nextDeliveryOrders = "—"; // TODO: koble på /api/admin/orders/next
  const costLabel = "Siste 14 dager";
  const costAmount = "—"; // TODO: koble på /api/admin/invoices/summary
  const sustainabilityValue = "—"; // TODO: koble på /api/admin/sustainability/summary

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(176,139,87,.20),transparent),radial-gradient(1000px_600px_at_100%_10%,rgba(16,185,129,.12),transparent)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Topbar */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-600">
              Admin · {companyName} · {ctx.profile.location_id ? "Lokasjon valgt" : "Lokasjon ikke satt"}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">Command Center</h1>
            <p className="mt-2 text-neutral-600">Rask oversikt, tydelige rammer og kontroll — uten støy.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HealthPill health={health} />
            <GhostLink href="/admin/agreement">Avtale</GhostLink>
            <GhostLink href="/admin/people">Ansatte</GhostLink>
            <GhostLink href="/admin/history">Historikk</GhostLink>
            <GhostLink href="/admin/locations">Lokasjoner</GhostLink>
            <PrimaryLink href="/admin/orders">Ordreoversikt</PrimaryLink>
          </div>
        </div>

        {/* Hero KPIs */}
        <Card
          title="Oversikt"
          subtitle="Dette er det eneste du trenger å se først."
          right={
            <span className="inline-flex items-center rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-black/10">
              Firma: ACTIVE
            </span>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi
              label="Neste levering"
              value={`${nextDeliveryLabel} · ${nextDeliveryOrders} bestillinger`}
              hint="Cut-off: kl. 08:00 (Europe/Oslo)"
              href="/admin/orders"
            />
            <Kpi
              label={`Kostnad (${costLabel})`}
              value={costAmount}
              hint="Basert på registrerte bestillinger (read-only)."
              href="/admin/history"
            />
            <Kpi
              label="Bærekraft"
              value={sustainabilityValue}
              hint="Matsvinn og kontroll (kommer)."
              href="/admin/history"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <GhostLink href="/api/admin/invoices/csv">Last ned fakturagrunnlag (CSV)</GhostLink>
            <GhostLink href="/admin/history">Eksport & historikk</GhostLink>
            <GhostLink href="/admin/people">Administrer ansatte</GhostLink>
          </div>
        </Card>

        {/* People summary */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card
              title="Ansatte"
              subtitle="Dette er admin-ansvar. Ansatte styrer bestilling/avbestilling selv."
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <GhostLink href="/admin/people">Åpne People</GhostLink>
                  <PrimaryLink href="/admin/invite">Inviter</PrimaryLink>
                </div>
              }
            >
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
                  <p className="mt-1 text-sm text-neutral-600">Ingen deaktiverte ansatte akkurat nå.</p>
                </div>
              )}
            </Card>
          </div>

          {/* Exports + Support */}
          <div className="space-y-6">
            <Card title="Fakturagrunnlag" subtitle="CSV for økonomi — ferdig formatert.">
              <div className="flex flex-col gap-3">
                <PrimaryLink href="/api/admin/invoices/csv">Last ned (siste 14 dager)</PrimaryLink>
                <div className="text-sm text-neutral-600">
                  Historikk er lesemodus. Cut-off og avtale kan ikke overstyres manuelt.
                </div>
              </div>
            </Card>

            <Card title="Support" subtitle="Hvis noe ikke stemmer, send en rapport med én gang.">
              <div className="flex flex-col gap-3">
                <SupportReportButton
                  reason="COMPANY_ADMIN_COMMAND_CENTER_SUPPORT_REPORT"
                  companyId={ctx.companyId}
                  locationId={ctx.profile.location_id ?? null}
                />
                <div className="text-sm text-neutral-600">
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

        {/* Footer */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
          <span>Command Center viser kun beslutningsverdi. Detaljer ligger på undersider.</span>
          <Link className="font-semibold text-neutral-700 hover:text-neutral-900" href="/week">
            Til ansattvisning →
          </Link>
        </div>
      </div>
    </main>
  );
}
