// app/leverandor/kunder/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import CustomerList from "@/components/providers/CustomerList";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderCustomers, type ProviderCustomerFilter } from "@/lib/providers/loadProviderCustomers";
import { loadProviderOperationalSettings } from "@/lib/providers/loadProviderOperationalSettings";

function parseFilter(raw: string | undefined): ProviderCustomerFilter {
  const v = String(raw ?? "all").toLowerCase();
  if (v === "active" || v === "suspended" || v === "paused" || v === "deleted") return v;
  return "all";
}

export default async function LeverandorKunderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fkunder");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const sp = await searchParams;
  const filter = parseFilter(typeof sp.filter === "string" ? sp.filter : undefined);
  const search = typeof sp.q === "string" ? sp.q : "";
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const canManage = await hasProviderRole(auth.user.id, provider.id, "provider_admin");

  const [list, settings] = await Promise.all([
    loadProviderCustomers(provider.id, filter, search, page),
    loadProviderOperationalSettings(provider.id),
  ]);

  const t = await getTranslations("provider.customers.page");
  const providerName = String(provider.name ?? "").trim();
  const lead = providerName ? t("leadWithProvider", { providerName }) : t("leadDefault");

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h1 className="ds-h2">{t("heading")}</h1>
          <p className="ds-lead">{lead}</p>
        </div>
      </header>
      <CustomerList initial={list} locale={settings.locale} canManage={canManage} />
    </div>
  );
}
