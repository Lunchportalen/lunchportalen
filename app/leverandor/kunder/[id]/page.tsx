// app/leverandor/kunder/[id]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { notFound, redirect } from "next/navigation";

import CustomerDetailClient from "@/components/providers/CustomerDetailClient";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderCustomerDetail } from "@/lib/providers/loadProviderCustomerDetail";

export default async function LeverandorKundeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fkunder");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const { id } = await params;
  const companyId = String(id ?? "").trim();
  if (!companyId) notFound();

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) notFound();

  const detail = await loadProviderCustomerDetail(provider.id, companyId);
  if (!detail) notFound();

  const canManage = await hasProviderRole(auth.user.id, provider.id, "provider_admin");

  return (
    <div className="ds-container">
      <CustomerDetailClient detail={detail} canManage={canManage} />
    </div>
  );
}
