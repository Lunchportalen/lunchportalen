"use client";

import { useTranslations } from "next-intl";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { catalogSupportsPersistentEdit } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import type { ProviderMenuWorkspacePresentationProps } from "@/lib/provider-menu/providerMenuProfilePresentation";
import type { MenuProfileFixedCategoryPresentationProps } from "@/lib/provider-menu/providerMenuProfileFixedCategories";
import type { ProviderMenuRuntimeMappingProposalProps } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import ProviderMenuCatalogEditor from "@/components/providers/ProviderMenuCatalogEditor";
import ProviderMenuProfilePresentationBanner from "@/components/providers/ProviderMenuProfilePresentationBanner";
import ProviderMenuProfileFixedCategoriesPanel from "@/components/providers/ProviderMenuProfileFixedCategoriesPanel";
import ProviderMenuRuntimeMappingProposalPanel from "@/components/providers/ProviderMenuRuntimeMappingProposalPanel";

type Props = {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
  workspacePresentation?: ProviderMenuWorkspacePresentationProps;
  fixedCategoryPresentation?: MenuProfileFixedCategoryPresentationProps;
  runtimeMappingProposal?: ProviderMenuRuntimeMappingProposalProps;
  mappingDraftSaveEnabled?: boolean;
  canSaveMappingDraft?: boolean;
};

const PACKAGE_TIERS: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

const TIER_CONTEXT_KEY: Record<PlanTier, "basis" | "luxus" | "enterprise"> = {
  BASIS: "basis",
  LUXUS: "luxus",
  ENTERPRISE: "enterprise",
};

export default function ProviderMenuCatalogView({
  tier,
  catalog,
  onCatalogSaved,
  workspacePresentation = { active: false },
  fixedCategoryPresentation = { active: false },
  runtimeMappingProposal = { active: false },
  mappingDraftSaveEnabled = false,
  canSaveMappingDraft = false,
}: Props) {
  const t = useTranslations("provider.menu");
  const profilePresentation = workspacePresentation.active ? workspacePresentation : null;
  const fixedCategories = fixedCategoryPresentation.active ? fixedCategoryPresentation : null;
  const runtimeMapping = runtimeMappingProposal.active ? runtimeMappingProposal : null;

  return (
    <section className="lp-editor-catalog" aria-label={t("catalogModel.title")}>
      {profilePresentation ? <ProviderMenuProfilePresentationBanner presentation={profilePresentation} /> : null}
      {fixedCategories ? <ProviderMenuProfileFixedCategoriesPanel presentation={fixedCategories} /> : null}
      {runtimeMapping ? (
        <ProviderMenuRuntimeMappingProposalPanel
          proposal={runtimeMapping}
          draftSaveEnabled={mappingDraftSaveEnabled}
          canSaveDraft={canSaveMappingDraft}
        />
      ) : null}

      <header className="lp-editor-catalog__head">
        <h2 className="ds-h4">{t("catalogModel.title")}</h2>
        <p className="ds-body">{t("catalogModel.lead")}</p>
      </header>

      <section className="lp-editor-catalog-model" aria-labelledby="lp-editor-catalog-model-title">
        <h3 id="lp-editor-catalog-model-title" className="lp-editor-catalog-model__title">
          {t("catalogModel.packageMatrix.title")}
        </h3>
        <div className="lp-editor-catalog-model__matrix">
          {profilePresentation
            ? profilePresentation.packageTiers.map((pkg) => (
                <article
                  key={pkg.tier}
                  className={`lp-editor-catalog-model__card${tier === pkg.tier ? " is-active" : ""}`}
                  data-testid={`profile-package-${pkg.tier.toLowerCase()}`}
                >
                  <h4 className="lp-editor-catalog-model__card-title">{pkg.title}</h4>
                  <p className="lp-editor-catalog-model__card-text">{pkg.text}</p>
                </article>
              ))
            : PACKAGE_TIERS.map((planTier) => (
                <article
                  key={planTier}
                  className={`lp-editor-catalog-model__card${tier === planTier ? " is-active" : ""}`}
                >
                  <h4 className="lp-editor-catalog-model__card-title">
                    {t(`catalogModel.packageMatrix.${TIER_CONTEXT_KEY[planTier]}.title`)}
                  </h4>
                  <p className="lp-editor-catalog-model__card-text">
                    {t(`catalogModel.packageMatrix.${TIER_CONTEXT_KEY[planTier]}.text`)}
                  </p>
                </article>
              ))}
        </div>
      </section>

      <p className="lp-editor-catalog-model__tier-context" role="status">
        {profilePresentation
          ? profilePresentation.tierContext[tier]
          : t(`catalogModel.tierContext.${TIER_CONTEXT_KEY[tier]}`)}
      </p>

      <aside className="lp-editor-catalog-model__callouts" aria-label={t("catalogModel.fixedChoicesTitle")}>
        <div className="lp-editor-catalog-model__callout">
          <b className="lp-editor-catalog-model__callout-title">
            {profilePresentation
              ? profilePresentation.sharedWarmDish.title
              : t("catalogModel.sharedWarmDish.title")}
          </b>
          <p className="lp-editor-catalog-model__callout-text">
            {profilePresentation
              ? profilePresentation.sharedWarmDish.text
              : t("catalogModel.sharedWarmDish.text")}
          </p>
        </div>
        <div className="lp-editor-catalog-model__callout">
          <b className="lp-editor-catalog-model__callout-title">
            {profilePresentation
              ? profilePresentation.enterpriseUpgrade.title
              : t("catalogModel.enterpriseUpgrade.title")}
          </b>
          <p className="lp-editor-catalog-model__callout-text">
            {profilePresentation
              ? profilePresentation.enterpriseUpgrade.text
              : t("catalogModel.enterpriseUpgrade.text")}
          </p>
        </div>
      </aside>

      <section className="lp-editor-catalog-model__editor" aria-labelledby="lp-editor-catalog-fixed-title">
        <header className="lp-editor-catalog-model__editor-head">
          <h3 id="lp-editor-catalog-fixed-title" className="lp-editor-catalog-model__editor-title">
            {t("catalogModel.fixedChoicesTitle")}
          </h3>
          <p className="lp-editor-catalog-model__editor-lead">{t("catalogModel.weekPlanHint")}</p>
        </header>

        {catalogSupportsPersistentEdit() ? (
          <ProviderMenuCatalogEditor
            tier={tier}
            catalog={catalog}
            onCatalogSaved={onCatalogSaved}
            panelMode
            filterByTier
            hidePageHeader
          />
        ) : null}
      </section>
    </section>
  );
}
