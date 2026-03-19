// app/admin/locations/page.tsx
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
import LocationsPanel from "@/components/admin/LocationsPanel";

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

export default async function AdminLocationsPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/locations",
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
            ]}
          />
        </div>
      </main>
    );
  }

  const companyName = ctx.company?.name ?? "Firma";

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(176,139,87,.20),transparent),radial-gradient(1000px_600px_at_100%_10%,rgba(16,185,129,.12),transparent)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Topbar */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-600">
              Admin · {companyName} · Lokasjoner
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">Lokasjoner</h1>
            <p className="mt-2 text-neutral-600">Aktiver eller deaktiver leveringslokasjoner innenfor avtalt scope.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostLink href="/admin">← Command Center</GhostLink>
            <GhostLink href="/admin/people">Ansatte</GhostLink>
            <PrimaryLink href="/admin/history">Historikk</PrimaryLink>
          </div>
        </div>

        <SectionCard
          title="Lokasjoner"
          subtitle="Dette er firmaets registrerte leveringslokasjoner."
          right={
            <SupportReportButton
              reason="COMPANY_ADMIN_LOCATIONS_SUPPORT_REPORT"
              companyId={ctx.companyId}
              locationId={ctx.profile.location_id ?? null}
            />
          }
        >
          <LocationsPanel companyId={ctx.companyId} />

          <div className="mt-6 rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
            <div className="text-xs font-semibold tracking-wide text-neutral-700">Merk</div>
            <p className="mt-1 text-sm text-neutral-700">
              Avtale, priser og leveranseoppsett endres kun av superadmin.
            </p>
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
          <span>Lokasjoner kan aktiveres/deaktiveres av kunde-admin. Avtaleendringer gjøres av superadmin.</span>
          <Link className="font-semibold text-neutral-700 hover:text-neutral-900" href="/admin">
            Til Command Center →
          </Link>
        </div>
      </div>
    </main>
  );
}
