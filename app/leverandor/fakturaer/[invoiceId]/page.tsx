// app/leverandor/fakturaer/[invoiceId]/page.tsx — fakturadokument + handlinger (Fase 8).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { loadInvoiceWithLines } from "@/lib/billing/invoiceLifecycle";
import InvoiceDocument from "@/components/billing/InvoiceDocument";
import InvoiceDetailActions from "@/components/billing/InvoiceDetailActions";

export default async function ProviderInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Ffakturaer");
  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");
  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");
  const canManage = await hasProviderRole(auth.user.id, provider.id, "provider_admin");

  const bundle = await loadInvoiceWithLines(invoiceId);
  // Tenant law: kun egen providers fakturaer — ellers 404.
  if (!bundle || bundle.head.provider_id !== provider.id) notFound();

  return (
    <div className="ds-container mx-auto w-full max-w-[900px] px-4 py-6 print:max-w-none print:px-0">
      <div className="mb-4 print:hidden">
        <Link href="/leverandor/fakturaer" className="text-sm font-semibold underline underline-offset-4">
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

      {canManage ? (
        <InvoiceDetailActions
          invoiceId={bundle.head.id}
          status={bundle.head.status}
          kind={bundle.head.kind}
          amountTotal={bundle.head.amount_total}
          amountPaid={bundle.head.amount_paid}
        />
      ) : null}
    </div>
  );
}
