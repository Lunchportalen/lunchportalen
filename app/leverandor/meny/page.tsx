export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import ProviderMenuBuilder from "@/components/providers/ProviderMenuBuilder";
import ProviderMenuGeneratorPreviewPanel from "@/components/providers/ProviderMenuGeneratorPreviewPanel";
import { buildProviderMenuGeneratorPreviewPresentation } from "@/lib/provider-menu/providerMenuGeneratorPresentation";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { buildProviderMenuWorkspacePresentation } from "@/lib/provider-menu/providerMenuProfilePresentation";
import { buildProviderMenuFixedCategoryPresentation } from "@/lib/provider-menu/providerMenuProfileFixedCategories";
import { buildProviderMenuWarmDishPreviewPresentation } from "@/lib/provider-menu/providerMenuProfileWarmDishPreview";
import { buildProviderMenuWarmDishGenerationPresentation } from "@/lib/provider-menu/providerMenuProfileWarmDishGeneration";
import { buildProviderMenuRuntimeMappingProposalPresentation } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import type { CurrencyCode } from "@/lib/menu-profile/types";
import {
  isMenuProfileMappingDraftSaveUiEnabled,
  isMenuProfileRuntimeMappingProposalPanelEnabled,
} from "@/lib/menu-profile/featureFlag";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import {
  loadAndResolveProviderMenuProfile,
  loadProviderSettingsMenuProfileRow,
} from "@/lib/providers/loadProviderSettingsMenuProfile";
import {
  buildProfileRuntimeCategoryLabelsFromResolver,
} from "@/lib/menu-profile/profileMenuRuntime";
import { buildLocalizedMenuSurfacePresentation } from "@/lib/menu-generator/localizedMenuSurface";
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
  const canSaveMappingDraft = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
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
  const fixedCategoryPresentation = buildProviderMenuFixedCategoryPresentation(
    menuProfileResolver,
    menuProfileRow?.defaultCurrency ?? getMarketDefaults("NO").defaultCurrency,
    menuProfileEnv,
  );
  const warmDishPreviewPresentation = buildProviderMenuWarmDishPreviewPresentation(
    menuProfileResolver,
    menuProfileRow?.defaultCurrency ?? getMarketDefaults("NO").defaultCurrency,
    menuProfileEnv,
  );
  const warmDishGenerationPresentation = buildProviderMenuWarmDishGenerationPresentation(
    menuProfileResolver,
    menuProfileEnv,
  );

  const defaultCurrency: CurrencyCode =
    (menuProfileRow?.defaultCurrency as CurrencyCode | undefined) ??
    getMarketDefaults("NO").defaultCurrency;

  const runtimeMapping =
    isMenuProfileRuntimeMappingProposalPanelEnabled(menuProfileEnv) &&
    menuProfileResolver?.ok &&
    menuProfileResolver.enabled
      ? buildMenuProfileRuntimeMapping({
          menuProfile: menuProfileResolver.profile,
          currency: defaultCurrency,
        })
      : null;

  const runtimeMappingProposal = buildProviderMenuRuntimeMappingProposalPresentation(
    menuProfileResolver,
    defaultCurrency,
    runtimeMapping,
    menuProfileEnv,
    {
      fixedCategoryPresentation:
        fixedCategoryPresentation.active ? fixedCategoryPresentation : null,
      warmDishPreview:
        warmDishPreviewPresentation.active ? warmDishPreviewPresentation : null,
    },
  );

  const mappingDraftSaveEnabled =
    runtimeMappingProposal.active && isMenuProfileMappingDraftSaveUiEnabled(menuProfileEnv);

  const localizedMenuSurface = buildLocalizedMenuSurfacePresentation({
    providerId: provider.id,
    settingsRow: menuProfileRow,
    resolverResult: menuProfileResolver,
    env: menuProfileEnv,
  });

  const profileCategoryLabels = localizedMenuSurface.active
    ? localizedMenuSurface.categoryLabels
    : buildProfileRuntimeCategoryLabelsFromResolver(menuProfileResolver, menuProfileEnv);

  const generatorPreviewPresentation = buildProviderMenuGeneratorPreviewPresentation({
    providerId: provider.id,
    settingsRow: menuProfileRow,
    resolverResult: menuProfileResolver,
    env: menuProfileEnv,
  });

  return (
    <div className="ds-provider-meny-page lp-editor-page">
      <ProviderMenuGeneratorPreviewPanel presentation={generatorPreviewPresentation} canApply={canEdit} />
      {canSaveMappingDraft ? (
        <section className="ds-card ds-section">
          <h2 className="ds-h3">{t("translationsPromoTitle")}</h2>
          <p className="ds-body">{t("translationsPromoLead")}</p>
          <Link href="/leverandor/meny/oversettelser" className="ds-btn ds-btn-primary">
            {t("translationsPromoCta")}
          </Link>
        </section>
      ) : null}
      {canEdit ? (
        <ProviderMenuBuilder
          workspacePresentation={workspacePresentation}
          fixedCategoryPresentation={fixedCategoryPresentation}
          warmDishPreviewPresentation={warmDishPreviewPresentation}
          warmDishGenerationPresentation={warmDishGenerationPresentation}
          runtimeMappingProposal={runtimeMappingProposal}
          mappingDraftSaveEnabled={mappingDraftSaveEnabled}
          canSaveMappingDraft={canSaveMappingDraft}
          profileCategoryLabels={profileCategoryLabels ?? undefined}
          localizedMenuSurface={localizedMenuSurface}
        />
      ) : (
        <section className="ds-card ds-provider-meny-card">
          <h2 className="ds-h3">{t("readOnlyTitle")}</h2>
          <p className="ds-body">{t("readOnlyLead")}</p>
        </section>
      )}
    </div>
  );
}
