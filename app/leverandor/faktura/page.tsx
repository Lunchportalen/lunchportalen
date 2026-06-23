export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import ProviderBillingView from "@/components/providers/ProviderBillingView";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderBilling } from "@/lib/providers/loadProviderBilling";

export default async function LeverandorFakturaPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Ffaktura");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canEditContact = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  const bundle = await loadProviderBilling(provider.id);
  const t = await getTranslations("provider.billing.page");

  return (
    <div className="ds-container ds-provider-billing-page">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h1 className="ds-h2">{t("heading")}</h1>
          <p className="ds-lead">{t("subheading")}</p>
        </div>
      </header>
      <ProviderBillingView bundle={bundle} providerId={provider.id} canEditContact={canEditContact} />
    </div>
  );
}
