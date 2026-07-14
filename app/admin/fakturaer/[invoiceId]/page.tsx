// app/admin/fakturaer/[invoiceId]/page.tsx — fakturadetalj for firmaadmin (read-only).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { loadAdminContext, isAdminContextBlocked } from "@/lib/admin/loadAdminContext";
import BlockedState from "@/components/admin/BlockedState";
import { loadInvoiceWithLines } from "@/lib/billing/invoiceLifecycle";
import InvoiceDocument from "@/components/billing/InvoiceDocument";

export default async function CompanyInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const ctx = await loadAdminContext({
    nextPath: "/admin/fakturaer",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <BlockedState level="followup" title="Ingen tilgang" body="Fakturaer er for firmaadmin med firmascope." nextSteps={ctx.nextSteps} />
      </div>
    );
  }

  const bundle = await loadInvoiceWithLines(invoiceId);
  // Tenant law: kun eget firma, aldri provider-utkast/annullert — ellers 404.
  if (!bundle || bundle.head.company_id !== ctx.companyId || bundle.head.status === "DRAFT" || bundle.head.status === "VOID") {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 print:max-w-none print:px-0">
      <div className="mb-4 print:hidden">
        <Link href="/admin/fakturaer" className="text-sm font-semibold underline underline-offset-4">
          ← Alle fakturaer
        </Link>
      </div>
      <InvoiceDocument
        head={bundle.head}
        lines={bundle.lines}
        payments={bundle.payments}
        providerName={bundle.providerName}
        companyName={bundle.companyName}
        legal={bundle.legal}
      />
    </div>
  );
}
