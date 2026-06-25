"use client";

import { useTranslations } from "next-intl";

import type { MenuProfileFixedCategoryPresentation } from "@/lib/provider-menu/providerMenuProfileFixedCategories";

type Props = {
  presentation: MenuProfileFixedCategoryPresentation;
};

export default function ProviderMenuProfileFixedCategoriesPanel({ presentation }: Props) {
  const t = useTranslations("provider.menu.workspaceFixedCategories");

  return (
    <section
      className="lp-editor-profile-fixed-categories"
      data-testid="provider-menu-profile-fixed-categories-panel"
      aria-labelledby="lp-editor-profile-fixed-categories-title"
    >
      <header className="lp-editor-profile-fixed-categories__head">
        <h3 id="lp-editor-profile-fixed-categories-title" className="lp-editor-profile-fixed-categories__title">
          {t("title")}
        </h3>
        <p className="lp-editor-profile-fixed-categories__description">{t("description")}</p>
      </header>

      <ul className="lp-editor-profile-fixed-categories__list">
        {presentation.categories.map((category) => (
          <li
            key={category.profileCategoryKey}
            className="lp-editor-profile-fixed-categories__item"
            data-testid={`fixed-category-${category.profileCategoryKey}`}
          >
            <div className="lp-editor-profile-fixed-categories__item-head">
              <span className="lp-editor-profile-fixed-categories__label">{category.displayLabel}</span>
              <span
                className={`lp-editor-profile-fixed-categories__status${
                  category.isOrderRuntimeEnabled
                    ? " lp-editor-profile-fixed-categories__status--active"
                    : " lp-editor-profile-fixed-categories__status--future"
                }`}
              >
                {t(category.statusLabelKey)}
              </span>
            </div>

            <p className="lp-editor-profile-fixed-categories__meta">
              <span className="lp-editor-profile-fixed-categories__meta-label">
                {t("profileCategoryLabel")}:
              </span>{" "}
              <code className="lp-editor-profile-fixed-categories__key">{category.profileCategoryKey}</code>
            </p>

            <p className="lp-editor-profile-fixed-categories__meta">
              <span className="lp-editor-profile-fixed-categories__meta-label">{t("packagesLabel")}:</span>{" "}
              {category.packageTierLabels.join(", ")}
            </p>

            <p className="lp-editor-profile-fixed-categories__help">
              {category.isOrderRuntimeEnabled ? t("orderRuntimeEnabled") : t("presentationOnly")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
