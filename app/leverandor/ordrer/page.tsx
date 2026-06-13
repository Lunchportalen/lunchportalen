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
import { loadProviderOperationalSettings } from "@/lib/providers/loadProviderOperationalSettings";
import {
  PROVIDER_ORDERS_COPY,
  formatProviderOrdersDateRange,
  type ProviderOrdersDateMode,
} from "@/lib/providers/providerOrdersSurface";

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
  const dateModeRaw = typeof sp.date === "string" ? sp.date : "today";
  const dateMode: ProviderOrdersDateMode =
    dateModeRaw === "tomorrow" || dateModeRaw === "week" ? dateModeRaw : "today";
  const statusFilter = typeof sp.status === "string" && sp.status ? sp.status : null;
  const companyId = typeof sp.company === "string" && sp.company ? sp.company : null;
  const group = typeof sp.group === "string" ? sp.group : "company";

  const [bundle, canAdvance, settings] = await Promise.all([
    loadKitchenOrders(provider.id, { dateMode, statusFilter, companyId }),
    hasProviderRole(auth.user.id, provider.id, "provider_kitchen"),
    loadProviderOperationalSettings(provider.id),
  ]);

  const dateLabel = formatProviderOrdersDateRange(bundle.dateFrom, bundle.dateTo, settings.locale);

  return (
    <div className="ds-container ds-provider-kitchen-page">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">{PROVIDER_ORDERS_COPY.eyebrow}</p>
          <h1 className="ds-h2">{PROVIDER_ORDERS_COPY.heading}</h1>
          <p className="ds-lead">
            {provider.name}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
        </div>
      </header>

      <KitchenOrdersView
        bundle={bundle}
        canAdvance={canAdvance}
        groupMode={group}
        dateMode={dateMode}
        statusFilterActive={Boolean(statusFilter)}
      />
    </div>
  );
}
