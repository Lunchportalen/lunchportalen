// app/leverandor/innstillinger/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import ProviderSettingsForm from "@/components/providers/ProviderSettingsForm";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";

export default async function LeverandorInnstillingerPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Finnstillinger");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  if (!canEdit) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">Innstillinger</h1>
        <p className="ds-body">Kun provider-admin kan endre profilen.</p>
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
        <ProviderSettingsForm provider={provider} />
      </section>
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
