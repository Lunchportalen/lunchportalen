// app/leverandor/innstillinger/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import ProviderMenuProfileDiagnostic from "@/components/providers/ProviderMenuProfileDiagnostic";
import ProviderBrandColor from "@/components/providers/ProviderBrandColor";
import ProviderLogoUploader from "@/components/providers/ProviderLogoUploader";
import ProviderOperationsForm from "@/components/providers/ProviderOperationsForm";
import ProviderSettingsForm from "@/components/providers/ProviderSettingsForm";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderOperationalSettings } from "@/lib/providers/loadProviderOperationalSettings";
import { loadProviderMenuProfileDiagnostic } from "@/lib/providers/providerMenuProfileDiagnostic";

export default async function LeverandorInnstillingerPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Finnstillinger");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const t = await getTranslations("provider.settings.page");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  const operationalSettings = canEdit ? await loadProviderOperationalSettings(provider.id) : null;
  const menuProfileDiagnostic = canEdit ? await loadProviderMenuProfileDiagnostic(provider.id) : null;
  if (!canEdit) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">{t("heading")}</h1>
        <p className="ds-body">{t("readOnly")}</p>
      </div>
    );
  }

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h1 className="ds-h2">{t("heading")}</h1>
          <p className="ds-lead">{t("leadWithProvider", { providerName: provider.name })}</p>
        </div>
      </header>
      <section className="ds-section">
        <h2 className="ds-h3">{t("brandSection")}</h2>
        <p className="ds-body">{t("brandIntro")}</p>

        <h3 className="ds-provider-brand-heading">{t("logoHeading")}</h3>
        <p className="ds-body">{t("logoIntro")}</p>
        <ProviderLogoUploader providerId={provider.id} providerName={provider.name} logoUrl={provider.logoUrl} />
        <p className="ds-provider-brand-note">{t("logoNote")}</p>

        <h3 className="ds-provider-brand-heading">{t("colorHeading")}</h3>
        <p className="ds-body">{t("colorIntro")}</p>
        <ProviderBrandColor providerId={provider.id} primaryColor={provider.primaryColor} />
      </section>
      <section className="ds-section">
        <ProviderSettingsForm provider={provider} />
      </section>
      {operationalSettings ? (
        <section className="ds-section">
          <h2 className="ds-h3">{t("operationsSection")}</h2>
          <p className="ds-body">{t("operationsIntro")}</p>
          <p className="ds-body">{t("operationsNote")}</p>
          <ProviderOperationsForm providerId={provider.id} initial={operationalSettings} />
        </section>
      ) : null}
      {menuProfileDiagnostic ? (
        <section className="ds-section">
          <ProviderMenuProfileDiagnostic diagnostic={menuProfileDiagnostic} />
        </section>
      ) : null}
      <section className="ds-section">
        <h2 className="ds-h3">{t("accountingSection")}</h2>
        <p className="ds-body">{t("accountingIntro")}</p>
        <Link className="ds-btn ds-btn--primary" href="/leverandor/innstillinger/tripletex/koble-til">
          {t("tripletexSetup")}
        </Link>
      </section>
    </div>
  );
}
