"use client";

import { useTranslations } from "next-intl";

import type { ProviderMenuRuntimeMappingProposal } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import ProviderMenuRuntimeMappingDraftSaveControls from "@/components/providers/ProviderMenuRuntimeMappingDraftSaveControls";

type Props = {
  proposal: ProviderMenuRuntimeMappingProposal;
  draftSaveEnabled?: boolean;
  canSaveDraft?: boolean;
};

function categoryStatusBadgeKey(
  status: ProviderMenuRuntimeMappingProposal["categories"][number]["status"],
): "existingNoRuntimeMapping" | "notRuntimeSupportedYet" | null {
  if (status === "mapped_existing_no_runtime") return "existingNoRuntimeMapping";
  if (status === "shadow_only_non_no" || status === "presentation_only" || status === "unsupported") {
    return "notRuntimeSupportedYet";
  }
  return null;
}

export default function ProviderMenuRuntimeMappingProposalPanel({
  proposal,
  draftSaveEnabled = false,
  canSaveDraft = false,
}: Props) {
  const t = useTranslations("provider.menu.runtimeMappingProposal");

  return (
    <section
      className="lp-editor-runtime-mapping-proposal"
      data-testid="provider-menu-runtime-mapping-proposal-panel"
      aria-labelledby="lp-editor-runtime-mapping-proposal-title"
    >
      <header className="lp-editor-runtime-mapping-proposal__head">
        <h3 id="lp-editor-runtime-mapping-proposal-title" className="lp-editor-runtime-mapping-proposal__title">
          {t("title")}
        </h3>
        <p className="lp-editor-runtime-mapping-proposal__description">{t("description")}</p>
        <div className="lp-editor-runtime-mapping-proposal__badges">
          <span className="lp-editor-runtime-mapping-proposal__badge">{t("shadowOnly")}</span>
          <span className="lp-editor-runtime-mapping-proposal__badge">{t("notActiveInSave")}</span>
          <span className="lp-editor-runtime-mapping-proposal__badge">{t("notActiveInPublish")}</span>
          <span className="lp-editor-runtime-mapping-proposal__badge">{t("notVisibleToEmployees")}</span>
        </div>
        <p className="lp-editor-runtime-mapping-proposal__meta">
          {proposal.profileId} · {proposal.market} · {proposal.locale} · {proposal.currency} ·{" "}
          {proposal.mappingVersion}
        </p>
        {draftSaveEnabled ? (
          <ProviderMenuRuntimeMappingDraftSaveControls
            proposal={proposal}
            canSaveDraft={canSaveDraft}
          />
        ) : null}
      </header>

      <section
        className="lp-editor-runtime-mapping-proposal__summary"
        aria-labelledby="lp-editor-runtime-mapping-proposal-summary-title"
      >
        <h4 id="lp-editor-runtime-mapping-proposal-summary-title" className="lp-editor-runtime-mapping-proposal__section-title">
          {t("summary")}
        </h4>
        <ul className="lp-editor-runtime-mapping-proposal__summary-list">
          <li>{t("mappedCategories", { count: proposal.summary.mappedCategoryCount })}</li>
          <li>{t("unmappedCategories", { count: proposal.summary.unmappedCategoryCount })}</li>
          <li>{t("previewOnlyWarmDishes", { count: proposal.summary.previewOnlyWarmDishCount })}</li>
          <li>{t("runtimeEnabledCount", { count: proposal.summary.runtimeEnabledCount })}</li>
          <li>{t("canSaveCount", { count: proposal.summary.canSaveCount })}</li>
          <li>{t("canPublishCount", { count: proposal.summary.canPublishCount })}</li>
          <li>{t("canOrderCount", { count: proposal.summary.canOrderCount })}</li>
        </ul>
      </section>

      {proposal.warnings.length > 0 ? (
        <aside
          className="lp-editor-runtime-mapping-proposal__warnings"
          aria-labelledby="lp-editor-runtime-mapping-proposal-warnings-title"
        >
          <h4
            id="lp-editor-runtime-mapping-proposal-warnings-title"
            className="lp-editor-runtime-mapping-proposal__section-title"
          >
            {t("warningTitle")}
          </h4>
          <ul className="lp-editor-runtime-mapping-proposal__warnings-list">
            {proposal.warnings.map((warningKey) => (
              <li key={warningKey}>{t(`warnings.${warningKey}`)}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      <section
        className="lp-editor-runtime-mapping-proposal__categories"
        aria-labelledby="lp-editor-runtime-mapping-proposal-categories-title"
      >
        <h4
          id="lp-editor-runtime-mapping-proposal-categories-title"
          className="lp-editor-runtime-mapping-proposal__section-title"
        >
          {t("categoryMappings")}
        </h4>
        {proposal.categories.length === 0 ? (
          <p className="lp-editor-runtime-mapping-proposal__empty">{t("noItems")}</p>
        ) : (
          <ul className="lp-editor-runtime-mapping-proposal__list">
            {proposal.categories.map((category) => {
              const statusBadge = categoryStatusBadgeKey(category.status);
              return (
                <li
                  key={category.profileCategoryKey}
                  className="lp-editor-runtime-mapping-proposal__item"
                  data-testid={`runtime-mapping-category-${category.profileCategoryKey}`}
                >
                  <div className="lp-editor-runtime-mapping-proposal__item-head">
                    <span className="lp-editor-runtime-mapping-proposal__label">{category.profileLabel}</span>
                    {statusBadge ? (
                      <span className="lp-editor-runtime-mapping-proposal__status">{t(statusBadge)}</span>
                    ) : null}
                  </div>
                  <p className="lp-editor-runtime-mapping-proposal__meta-line">
                    <code className="lp-editor-runtime-mapping-proposal__key">{category.profileCategoryKey}</code>
                    {category.runtimeCategoryKey ? (
                      <>
                        {" → "}
                        <code className="lp-editor-runtime-mapping-proposal__key">{category.runtimeCategoryKey}</code>
                      </>
                    ) : null}
                  </p>
                  {category.runtimeLunchCategoryKey ? (
                    <p className="lp-editor-runtime-mapping-proposal__meta-line">
                      lunch:{" "}
                      <code className="lp-editor-runtime-mapping-proposal__key">
                        {category.runtimeLunchCategoryKey}
                      </code>
                    </p>
                  ) : null}
                  {category.runtimeOrderChoiceKey ? (
                    <p className="lp-editor-runtime-mapping-proposal__meta-line">
                      order:{" "}
                      <code className="lp-editor-runtime-mapping-proposal__key">
                        {category.runtimeOrderChoiceKey}
                      </code>
                    </p>
                  ) : null}
                  <p className="lp-editor-runtime-mapping-proposal__help">
                    {t(`${category.explanationLabelKey}Help`)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {proposal.warmDishPreview.length > 0 ? (
        <section
          className="lp-editor-runtime-mapping-proposal__warm-dishes"
          aria-labelledby="lp-editor-runtime-mapping-proposal-warm-dishes-title"
        >
          <h4
            id="lp-editor-runtime-mapping-proposal-warm-dishes-title"
            className="lp-editor-runtime-mapping-proposal__section-title"
          >
            {t("warmDishMappings")}
          </h4>
          <ul className="lp-editor-runtime-mapping-proposal__list">
            {proposal.warmDishPreview.map((item) => (
              <li
                key={item.warmDishPreviewId}
                className="lp-editor-runtime-mapping-proposal__item"
                data-testid={`runtime-mapping-warm-dish-${item.warmDishPreviewId}`}
              >
                <div className="lp-editor-runtime-mapping-proposal__item-head">
                  <span className="lp-editor-runtime-mapping-proposal__label">{item.title}</span>
                  <span className="lp-editor-runtime-mapping-proposal__status">{t(item.explanationLabelKey)}</span>
                </div>
                <p className="lp-editor-runtime-mapping-proposal__meta-line">
                  <code className="lp-editor-runtime-mapping-proposal__key">{item.warmDishPreviewId}</code>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
