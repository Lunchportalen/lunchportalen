export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import ProviderMenuBuilder from "@/components/providers/ProviderMenuBuilder";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { buildProviderMenuWorkspacePresentation } from "@/lib/provider-menu/providerMenuProfilePresentation";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import {
  loadAndResolveProviderMenuProfile,
  loadProviderSettingsMenuProfileRow,
} from "@/lib/providers/loadProviderSettingsMenuProfile";
import { menuProfileResolverHostEnv } from "@/lib/providers/providerMenuProfileDiagnostic";

export default async function LeverandorMenyPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fmeny");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_kitchen");
  const t = await getTranslations("provider.menu.page");

  const menuProfileEnv = menuProfileResolverHostEnv();
  const [menuProfileRow, menuProfileResolver] = await Promise.all([
    loadProviderSettingsMenuProfileRow(provider.id),
    loadAndResolveProviderMenuProfile(provider.id, menuProfileEnv),
  ]);
  const workspacePresentation = buildProviderMenuWorkspacePresentation(
    menuProfileResolver,
    menuProfileRow?.defaultCurrency ?? getMarketDefaults("NO").defaultCurrency,
  );

  return (
    <div className="ds-provider-meny-page lp-editor-page">
      {canEdit ? (
        <ProviderMenuBuilder workspacePresentation={workspacePresentation} />
      ) : (
        <section className="ds-card ds-provider-meny-card">
          <h2 className="ds-h3">{t("readOnlyTitle")}</h2>
          <p className="ds-body">{t("readOnlyLead")}</p>
        </section>
      )}
    </div>
  );
}
