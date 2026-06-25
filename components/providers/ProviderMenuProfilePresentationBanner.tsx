"use client";

import { useTranslations } from "next-intl";

import type { ProviderMenuWorkspacePresentation } from "@/lib/provider-menu/providerMenuProfilePresentation";

type Props = {
  presentation: ProviderMenuWorkspacePresentation;
};

export default function ProviderMenuProfilePresentationBanner({ presentation }: Props) {
  const t = useTranslations("provider.menu.workspaceProfile");

  const { meta } = presentation;

  return (
    <aside
      className="lp-editor-profile-presentation"
      data-testid="provider-menu-profile-presentation-banner"
      role="note"
    >
      <p className="lp-editor-profile-presentation__badge">{t("badge")}</p>
      <p className="lp-editor-profile-presentation__banner">{t("banner")}</p>
      <p className="lp-editor-profile-presentation__meta">
        {t("metaLine", {
          profileName: meta.profileName,
          market: meta.market,
          locale: meta.locale,
          currency: meta.defaultCurrency,
        })}
      </p>
    </aside>
  );
}
