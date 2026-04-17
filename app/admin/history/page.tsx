// app/admin/history/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { formatDateNO } from "@/lib/date/format";
import {
  formatCompanyOperativeHistoryWhenNb,
  loadCompanyOperativeRecentHistory,
} from "@/lib/server/admin/loadCompanyOperativeRecentHistory";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="lp-motion-btn inline-flex items-center justify-center rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-black/10 hover:bg-white active:scale-[0.99]"
    >
      {children}
    </Link>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="lp-motion-btn inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99]"
    >
      {children}
    </Link>
  );
}

function SectionCard({
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
    <section className="lp-card-glass rounded-3xl p-6">
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

function Tile({
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
  const inner = (
    <div className="lp-motion-card group rounded-2xl bg-neutral-50/70 p-5 ring-1 ring-black/5 hover:bg-white hover:shadow-[0_12px_38px_-30px_rgba(0,0,0,.45)]">
      <div className="text-xs font-semibold tracking-wide text-neutral-600">{label}</div>
      <div className="mt-2 text-xl font-extrabold text-neutral-900">{value}</div>
      {hint ? <div className="mt-2 text-sm text-neutral-600">{hint}</div> : null}
      {href ? (
        <div className="mt-4 text-sm font-semibold text-neutral-900 opacity-80 group-hover:opacity-100">
          Åpne →
        </div>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* =========================================================
   Blocked UI mapping
========================================================= */
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

export default async function AdminHistoryPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/history",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(176,139,87,.20),transparent),radial-gradient(1000px_600px_at_100%_10%,rgba(16,185,129,.12),transparent)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-6">
            <GhostLink href="/admin">← Tilbake</GhostLink>
          </div>

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
              { label: "company_id", value: ctx.companyId ?? "—" },
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

  const companyName = ctx.company?.name ?? "Firma";

  const operativeHistory = await loadCompanyOperativeRecentHistory({ companyId: ctx.companyId });

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(176,139,87,.20),transparent),radial-gradient(1000px_600px_at_100%_10%,rgba(16,185,129,.12),transparent)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Topbar */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-600">
              Firmaadmin · {companyName} · Historikk
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">Historikk</h1>
            <p className="mt-2 text-neutral-600">
              Lesemodus. Her finner du ordreoversikt og eksport for økonomi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostLink href="/admin">← Command Center</GhostLink>
            <GhostLink href="/admin/agreement">Avtale</GhostLink>
            <PrimaryLink href="/admin/orders">Ordreoversikt</PrimaryLink>
          </div>
        </div>

        <SectionCard
          title="Siste operative endringer"
          subtitle={`Gjelder firma: ${companyName}. Lesing fra audit_events (firmascopet filter) og siste ordre-rader for eget firma — samme kilder som drift bruker, uten ny logikkmotor.`}
        >
          {operativeHistory.warning_nb ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
              {operativeHistory.warning_nb}
            </div>
          ) : null}
          {operativeHistory.items.length === 0 ? (
            <p className="text-center text-sm text-neutral-700 sm:text-left">
              Ingen registrerte operative hendelser eller ordreoppdateringer i siste vindu for dette firmaet.
            </p>
          ) : (
            <ul className="mx-auto flex max-w-3xl flex-col gap-3">
              {operativeHistory.items.map((it, idx) => (
                <li
                  key={`${it.source_kind}-${it.sort_at}-${idx}`}
                  className="rounded-2xl bg-white/90 p-4 text-center ring-1 ring-black/5 sm:text-left"
                >
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{it.source_label_nb}</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{it.title_nb}</div>
                      <p className="mt-1 text-sm text-neutral-700">{it.body_nb}</p>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-neutral-600">
                      {formatCompanyOperativeHistoryWhenNb(it.sort_at)}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2">
                    {it.operative_date_iso ? (
                      <div>
                        <dt className="font-semibold text-neutral-500">Leveringsdato</dt>
                        <dd className="text-neutral-900">{formatDateNO(it.operative_date_iso)}</dd>
                      </div>
                    ) : null}
                    {it.location_label_nb ? (
                      <div>
                        <dt className="font-semibold text-neutral-500">Lokasjon</dt>
                        <dd className="text-neutral-900">{it.location_label_nb}</dd>
                      </div>
                    ) : null}
                    {it.slot_label_nb ? (
                      <div>
                        <dt className="font-semibold text-neutral-500">Vindu</dt>
                        <dd className="text-neutral-900">{it.slot_label_nb}</dd>
                      </div>
                    ) : null}
                    {it.actor_hint_nb ? (
                      <div>
                        <dt className="font-semibold text-neutral-500">Aktør</dt>
                        <dd className="break-all text-neutral-900">{it.actor_hint_nb}</dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
            <GhostLink href="/admin/orders">Ordrehistorikk</GhostLink>
            <GhostLink href="/week">Ukeplan</GhostLink>
            <GhostLink href="/admin/dagens-brukere">Dagens brukere</GhostLink>
            <GhostLink href="/admin/dagens-levering">Dagens levering</GhostLink>
            <GhostLink href="/admin">Oversikt</GhostLink>
          </div>
        </SectionCard>

        <SectionCard
          title="Eksport"
          subtitle="Dette er det økonomi faktisk trenger. Enkelt. Korrekt. Forutsigbart."
          right={
            <SupportReportButton
              reason="COMPANY_ADMIN_HISTORY_SUPPORT_REPORT"
              companyId={ctx.companyId}
              locationId={ctx.profile.location_id ?? null}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Tile
              label="Fakturagrunnlag (CSV)"
              value="Siste 14 dager"
              hint="Ferdig formatert for import/videreføring."
              href="/api/admin/invoices/csv"
            />
            <Tile
              label="Ordreoversikt"
              value="Søk og filtrer"
              hint="Se bestillinger per dato, status og lokasjon."
              href="/admin/orders"
            />
            <Tile
              label="Policy"
              value="Lesemodus"
              hint="Cut-off og avtale kan ikke overstyres manuelt."
            />
          </div>

          <div className="mt-6 rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
            <div className="text-xs font-semibold tracking-wide text-neutral-700">Merk</div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              <li className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                <span>CSV-eksporten følger avtalt prisnivå og faktiske registrerte bestillinger.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                <span>Hvis noe virker feil, send en support-rapport — så kan drift sjekke grunnlaget.</span>
              </li>
            </ul>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
              Vis teknisk info (kun ved behov)
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-neutral-950 p-4 text-xs text-white/85 ring-1 ring-black/10">
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
        </SectionCard>

        {/* Footer */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
          <span>Historikk er read-only for kunde-admin. Endringer håndteres via avtale og superadmin.</span>
          <Link className="font-semibold text-neutral-700 hover:text-neutral-900" href="/admin">
            Til Command Center →
          </Link>
        </div>
      </div>
    </main>
  );
}
