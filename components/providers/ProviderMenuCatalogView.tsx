"use client";

import { useTranslations } from "next-intl";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { catalogSupportsPersistentEdit } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import ProviderMenuCatalogEditor from "@/components/providers/ProviderMenuCatalogEditor";

type Props = {
  tier: PlanTier;
  catalog: ProviderMenuCatalogSnapshot;
  onCatalogSaved: (catalog: ProviderMenuCatalogSnapshot) => void;
};

const PACKAGE_TIERS: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

const TIER_CONTEXT_KEY: Record<PlanTier, "basis" | "luxus" | "enterprise"> = {
  BASIS: "basis",
  LUXUS: "luxus",
  ENTERPRISE: "enterprise",
};

export default function ProviderMenuCatalogView({ tier, catalog, onCatalogSaved }: Props) {
  const t = useTranslations("provider.menu");

  return (
    <section className="lp-editor-catalog" aria-label={t("catalogModel.title")}>
      <header className="lp-editor-catalog__head">
        <h2 className="ds-h4">{t("catalogModel.title")}</h2>
        <p className="ds-body">{t("catalogModel.lead")}</p>
      </header>

      <section className="lp-editor-catalog-model" aria-labelledby="lp-editor-catalog-model-title">
        <h3 id="lp-editor-catalog-model-title" className="lp-editor-catalog-model__title">
          {t("catalogModel.packageMatrix.title")}
        </h3>
        <div className="lp-editor-catalog-model__matrix">
          {PACKAGE_TIERS.map((planTier) => (
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
        {t(`catalogModel.tierContext.${TIER_CONTEXT_KEY[tier]}`)}
      </p>

      <aside className="lp-editor-catalog-model__callouts" aria-label={t("catalogModel.fixedChoicesTitle")}>
        <div className="lp-editor-catalog-model__callout">
          <b className="lp-editor-catalog-model__callout-title">
            {t("catalogModel.sharedWarmDish.title")}
          </b>
          <p className="lp-editor-catalog-model__callout-text">{t("catalogModel.sharedWarmDish.text")}</p>
        </div>
        <div className="lp-editor-catalog-model__callout">
          <b className="lp-editor-catalog-model__callout-title">
            {t("catalogModel.enterpriseUpgrade.title")}
          </b>
          <p className="lp-editor-catalog-model__callout-text">{t("catalogModel.enterpriseUpgrade.text")}</p>
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
