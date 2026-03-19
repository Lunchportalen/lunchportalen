// app/admin/insights/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminInsightsClient from "./AdminInsightsClient";

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
  return "Vi klarte ikke å hente nødvendig oversikt akkurat nå.";
}

function blockedLevel(ctx: AdminContextBlocked): "followup" | "critical" {
  return ctx.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

export default async function AdminInsightsPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/insights",
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

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(176,139,87,.20),transparent),radial-gradient(1000px_600px_at_100%_10%,rgba(16,185,129,.12),transparent)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-600">
              Admin · {ctx.company?.name ?? "Firma"} · Rapporter
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">ROI & stabilitet</h1>
            <p className="mt-2 text-neutral-600">
              Tallene under viser faktisk bruk og drift – uten estimater eller pynt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostLink href="/admin">← Command Center</GhostLink>
            <GhostLink href="/admin/people">Ansatte</GhostLink>
            <GhostLink href="/admin/orders">Ordre</GhostLink>
          </div>
        </div>

        <AdminInsightsClient />
      </div>
    </main>
  );
}
