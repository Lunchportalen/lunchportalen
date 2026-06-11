// app/leverandor/innstillinger/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import ProviderBrandColor from "@/components/providers/ProviderBrandColor";
import ProviderLogoUploader from "@/components/providers/ProviderLogoUploader";
import ProviderOperationsForm from "@/components/providers/ProviderOperationsForm";
import ProviderSettingsForm from "@/components/providers/ProviderSettingsForm";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderOperationalSettings } from "@/lib/providers/loadProviderOperationalSettings";

export default async function LeverandorInnstillingerPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Finnstillinger");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  const operationalSettings = canEdit ? await loadProviderOperationalSettings(provider.id) : null;
  if (!canEdit) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">Innstillinger</h1>
        <p className="ds-body">Du har lesetilgang. Innstillinger kan kun endres av administrator.</p>
      </div>
    );
  }

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Innstillinger</h1>
          <p className="ds-lead">Profil og kontaktinformasjon for {provider.name}.</p>
        </div>
      </header>
      <section className="ds-section">
        <h2 className="ds-h3">Logo og merkevare</h2>
        <p className="ds-body">
          Last opp logo og velg en kontrollert aksentfarge. Lunchportalen beholder layout, typografi og
          produktuttrykk.
        </p>

        <h3 className="ds-provider-brand-heading">Logo</h3>
        <p className="ds-body">
          Bruk en ren logo med transparent bakgrunn. Logoen vises kontrollert i leverandørmenyen.
        </p>
        <ProviderLogoUploader providerId={provider.id} providerName={provider.name} logoUrl={provider.logoUrl} />
        <p className="ds-provider-brand-note">
          Logoer som ikke følger plattformens visuelle standard kan bli avvist.
        </p>

        <h3 className="ds-provider-brand-heading">Primærfarge</h3>
        <p className="ds-body">Velg leverandørens aksentfarge. Fargen brukes kun i kontrollerte detaljer.</p>
        <ProviderBrandColor providerId={provider.id} primaryColor={provider.primaryColor} />
      </section>
      <section className="ds-section">
        <ProviderSettingsForm provider={provider} />
      </section>
      {operationalSettings ? (
        <section className="ds-section">
          <h2 className="ds-h3">Drift og varsling</h2>
          <p className="ds-body">
            Velg hvor ordre, kjøkkenvarsler og leveringsinformasjon skal sendes. Disse innstillingene gjelder kun
            for dette cateringfirmaet.
          </p>
          <ProviderOperationsForm providerId={provider.id} initial={operationalSettings} />
        </section>
      ) : null}
      <section className="ds-section">
        <h2 className="ds-h3">Regnskap</h2>
        <p className="ds-body">Koble Tripletex for automatisk fakturering og betalingsstatus.</p>
        <Link className="ds-btn ds-btn--primary" href="/leverandor/innstillinger/tripletex/koble-til">
          Tripletex-oppsett
        </Link>
      </section>
    </div>
  );
}
