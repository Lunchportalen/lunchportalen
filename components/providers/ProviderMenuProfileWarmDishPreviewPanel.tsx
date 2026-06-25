"use client";

import { useTranslations } from "next-intl";

import type { MenuProfileWarmDishPreview } from "@/lib/provider-menu/providerMenuProfileWarmDishPreview";

type Props = {
  presentation: MenuProfileWarmDishPreview;
};

export default function ProviderMenuProfileWarmDishPreviewPanel({ presentation }: Props) {
  const t = useTranslations("provider.menu.workspaceWarmDishPreview");

  return (
    <section
      className="lp-editor-profile-warm-dish-preview"
      data-testid="provider-menu-profile-warm-dish-preview-panel"
      aria-labelledby="lp-editor-profile-warm-dish-preview-title"
    >
      <header className="lp-editor-profile-warm-dish-preview__head">
        <h3 id="lp-editor-profile-warm-dish-preview-title" className="lp-editor-profile-warm-dish-preview__title">
          {t("title")}
        </h3>
        <p className="lp-editor-profile-warm-dish-preview__description">{t("description")}</p>
        <div className="lp-editor-profile-warm-dish-preview__badges">
          <span className="lp-editor-profile-warm-dish-preview__badge">{t("previewOnly")}</span>
          <span className="lp-editor-profile-warm-dish-preview__badge">{t("notPublished")}</span>
          <span className="lp-editor-profile-warm-dish-preview__badge">{t("notVisibleToEmployees")}</span>
        </div>
        <p className="lp-editor-profile-warm-dish-preview__meta">
          {t("profileMeta", {
            profileId: presentation.profileId,
            market: presentation.marketLabel,
            locale: presentation.locale,
            currency: presentation.currency,
          })}
        </p>
      </header>

      {presentation.items.length === 0 ? (
        <p className="lp-editor-profile-warm-dish-preview__empty">{t("noItems")}</p>
      ) : (
        <ul className="lp-editor-profile-warm-dish-preview__list">
          {presentation.items.map((item) => (
            <li
              key={item.id}
              className="lp-editor-profile-warm-dish-preview__item"
              data-testid={`warm-dish-preview-${item.id}`}
            >
              <div className="lp-editor-profile-warm-dish-preview__item-head">
                <span className="lp-editor-profile-warm-dish-preview__label">{item.title}</span>
                <span className="lp-editor-profile-warm-dish-preview__status">{t(item.statusLabelKey)}</span>
              </div>

              {item.description ? (
                <p className="lp-editor-profile-warm-dish-preview__item-desc">{item.description}</p>
              ) : null}

              {item.suggestedTags.length > 0 ? (
                <p className="lp-editor-profile-warm-dish-preview__meta-line">
                  <span className="lp-editor-profile-warm-dish-preview__meta-label">{t("tagsLabel")}:</span>{" "}
                  {item.suggestedTags.join(", ")}
                </p>
              ) : null}

              {item.suggestedAllergens.length > 0 ? (
                <p className="lp-editor-profile-warm-dish-preview__meta-line">
                  <span className="lp-editor-profile-warm-dish-preview__meta-label">{t("allergensLabel")}:</span>{" "}
                  {item.suggestedAllergens.join(", ")}
                </p>
              ) : null}

              {item.suggestedTiers.length > 0 ? (
                <p className="lp-editor-profile-warm-dish-preview__meta-line">
                  <span className="lp-editor-profile-warm-dish-preview__meta-label">{t("suggestedTiers")}:</span>{" "}
                  {item.suggestedTiers.join(", ")}
                </p>
              ) : null}

              {item.suggestedWeekday ? (
                <p className="lp-editor-profile-warm-dish-preview__meta-line">
                  <span className="lp-editor-profile-warm-dish-preview__meta-label">{t("weekdayLabel")}:</span>{" "}
                  {t(`weekdays.${item.suggestedWeekday}`)}
                </p>
              ) : null}

              <p className="lp-editor-profile-warm-dish-preview__help">{t(item.helpTextKey)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
