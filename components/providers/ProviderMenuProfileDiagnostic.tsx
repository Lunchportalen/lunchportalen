// components/providers/ProviderMenuProfileDiagnostic.tsx
import { getTranslations } from "next-intl/server";

import type { ProviderMenuProfileDiagnostic } from "@/lib/providers/providerMenuProfileDiagnostic";

const SOURCE_KEYS = {
  provider_setting: "sourceProviderSetting",
  market_default: "sourceMarketDefault",
  fallback_no_market: "sourceFallbackNoMarket",
  legacy_disabled: "sourceLegacyDisabled",
} as const;

export default async function ProviderMenuProfileDiagnostic({
  diagnostic,
}: {
  diagnostic: ProviderMenuProfileDiagnostic;
}) {
  const t = await getTranslations("provider.settings.menuProfile");

  if (diagnostic.kind === "error") {
    return (
      <div className="ds-card ds-provider-menu-profile-diagnostic" data-testid="provider-menu-profile-diagnostic-error">
        <h2 className="ds-h3">{t("heading")}</h2>
        <p className="ds-body">{t("flagActive")}</p>
        <p className="ds-body ds-text-danger" role="alert">
          {t("invalidProfile", { message: diagnostic.message })}
        </p>
      </div>
    );
  }

  const sourceKey = SOURCE_KEYS[diagnostic.source] ?? "sourceUnknown";

  return (
    <div className="ds-card ds-provider-menu-profile-diagnostic" data-testid="provider-menu-profile-diagnostic">
      <h2 className="ds-h3">{t("heading")}</h2>
      <p className="ds-body">{t("flagActive")}</p>
      <dl className="ds-provider-menu-profile-diagnostic__list">
        <div className="ds-provider-menu-profile-diagnostic__row">
          <dt>{t("profileLabel")}</dt>
          <dd>{diagnostic.profileName}</dd>
        </div>
        <div className="ds-provider-menu-profile-diagnostic__row">
          <dt>{t("sourceLabel")}</dt>
          <dd>{t(sourceKey)}</dd>
        </div>
        <div className="ds-provider-menu-profile-diagnostic__row">
          <dt>{t("marketLabel")}</dt>
          <dd>{diagnostic.market}</dd>
        </div>
        <div className="ds-provider-menu-profile-diagnostic__row">
          <dt>{t("localeLabel")}</dt>
          <dd>{diagnostic.locale}</dd>
        </div>
        <div className="ds-provider-menu-profile-diagnostic__row">
          <dt>{t("currencyLabel")}</dt>
          <dd>{diagnostic.currencyDefault}</dd>
        </div>
      </dl>
      {diagnostic.warning ? (
        <p className="ds-body ds-text-muted" role="status">
          {diagnostic.warning}
        </p>
      ) : null}
      <p className="ds-body ds-text-muted">{t("readOnlyNote")}</p>
    </div>
  );
}
