// app/admin/fakturering/page.tsx — fakturaprofil for firmaadmin (Fase 5).
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  loadAdminContext,
  isAdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import AdminPageShell from "@/components/admin/AdminPageShell";
import BlockedState from "@/components/admin/BlockedState";
import BillingProfileForm from "@/components/admin/BillingProfileForm";

export default async function Page() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/fakturering",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <BlockedState
          level="followup"
          title="Ingen tilgang"
          body="Fakturaprofil er for firmaadmin med firmascope."
          nextSteps={ctx.nextSteps}
          meta={[{ label: "company_id", value: ctx.companyId ?? "-" }]}
        />
      </div>
    );
  }

  return (
    <AdminPageShell
      title="Fakturering"
      subtitle="Fakturamottaker, referanse og kostnadssted for firmaet."
      actions={null}
    >
      <BillingProfileForm />
    </AdminPageShell>
  );
}
