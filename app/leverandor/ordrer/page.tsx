// app/leverandor/ordrer/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import KitchenOrdersView from "@/components/providers/KitchenOrdersView";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadKitchenOrders } from "@/lib/providers/loadKitchenOrders";

export default async function LeverandorOrdrerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fordrer");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const sp = await searchParams;
  const dateMode = (typeof sp.date === "string" ? sp.date : "today") as "today" | "tomorrow" | "week";
  const statusFilter = typeof sp.status === "string" && sp.status ? sp.status : null;
  const companyId = typeof sp.company === "string" && sp.company ? sp.company : null;
  const group = typeof sp.group === "string" ? sp.group : "company";

  const bundle = await loadKitchenOrders(provider.id, { dateMode, statusFilter, companyId });
  const canAdvance = await hasProviderRole(auth.user.id, provider.id, "provider_kitchen");

  return (
    <div className="ds-container ds-provider-kitchen-page">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Kjøkken</p>
          <h1 className="ds-h2">Ordrer</h1>
          <p className="ds-lead">
            {provider.name} · {bundle.dateFrom}
            {bundle.dateFrom !== bundle.dateTo ? ` – ${bundle.dateTo}` : ""}
          </p>
        </div>
      </header>

      <KitchenOrdersView bundle={bundle} canAdvance={canAdvance} groupMode={group} />
    </div>
  );
}
