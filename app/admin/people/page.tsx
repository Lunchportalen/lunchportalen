// app/admin/people/page.tsx
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
import PeopleClient from "./PeopleClient";

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
  return "Vi klarte ikke å hente nødvendig oversikt akkurat nå.";
}

function blockedLevel(ctx: AdminContextBlocked): "followup" | "critical" {
  return ctx.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

export default async function AdminPeoplePage({ searchParams }: { searchParams?: { q?: string } }) {
  const ctx = await loadAdminContext({
    nextPath: "/admin/people",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="lp-btn lp-btn--ghost min-h-[44px] border border-[rgb(var(--lp-border))] bg-white/70 px-4 py-2 text-sm font-semibold"
          >
            Tilbake
          </Link>
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
              buttonClassName="lp-btn lp-btn--secondary"
            />
          }
          meta={[
            { label: "auth.user.id", value: ctx.dbg.authUserId },
            { label: "auth.user.email", value: ctx.dbg.authEmail || "-" },
            { label: "company_id", value: ctx.companyId ?? "-" },
            { label: "env.url", value: ctx.dbg.envSupabaseUrl ?? "-" },
            { label: "env.hasServiceKey", value: String(ctx.dbg.hasServiceKey) },
            ...(ctx.dbg.q_company ? [{ label: "company.err", value: ctx.dbg.q_company.error ?? "-" }] : []),
            ...(Object.entries(ctx.dbg.q_counts ?? {})
              .filter(([, v]) => v)
              .slice(0, 10)
              .map(([k, v]) => ({ label: `count.${k}`, value: String(v) }))),
          ]}
        />
      </div>
    );
  }

  const { companyId, user, profile } = ctx;

  return (
    <PeopleClient
      initialQuery={typeof searchParams?.q === "string" ? searchParams?.q : ""}
      viewerEmail={user.email ?? user.id}
      supportCompanyId={companyId}
      supportLocationId={profile.location_id ?? null}
    />
  );
}

