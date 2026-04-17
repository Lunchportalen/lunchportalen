// app/admin/leveringsgrunnlag/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { fetchAgreementPageDataForAdmin } from "@/lib/admin/fetchAgreementPageDataServer";
import { loadCompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AgreementDeliveryBasisView from "@/components/admin/AgreementDeliveryBasisView";

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

export default async function LeveringsgrunnlagPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/leveringsgrunnlag",
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

  const [agr, brief] = await Promise.all([
    fetchAgreementPageDataForAdmin(null),
    loadCompanyOperationalBrief({
      companyId: ctx.companyId,
      locationId: ctx.profile?.location_id ?? null,
      companyStatusUpper: String(ctx.company?.status ?? "ACTIVE").toUpperCase(),
    }),
  ]);

  const agreement = agr.kind === "ok" ? agr.data : null;

  return (
    <AdminPageShell
      title="Leveringsgrunnlag"
      subtitle="Read-only leveringsrammer for eget firma — ingen pris, binding eller operativ unntakshåndtering her."
      actions={null}
    >
      {agr.kind === "error" ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          Avtaledata kunne ikke lastes ({agr.errorCode ?? "feil"}). Operativ status fra firmadagens drift vises likevel.
        </div>
      ) : null}
      <AgreementDeliveryBasisView brief={brief} agreement={agreement} />
    </AdminPageShell>
  );
}
