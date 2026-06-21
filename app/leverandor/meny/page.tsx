export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import ProviderMenuBuilder from "@/components/providers/ProviderMenuBuilder";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";

export default async function LeverandorMenyPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fmeny");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_kitchen");

  return (
    <div className="ds-provider-meny-page lp-editor-page">
      <header className="ds-provider-topbar ds-provider-menu-page__header">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Meny</h1>
          <p className="ds-lead">Planlegg uke, sett dagens felles varmrett og publiser for bestilling.</p>
        </div>
      </header>

      {canEdit ? (
        <ProviderMenuBuilder />
      ) : (
        <section className="ds-card ds-provider-meny-card">
          <h2 className="ds-h3">Kun visning</h2>
          <p className="ds-body">
            Du har ikke tilgang til å redigere meny. Kontakt leverandøradministrator for å få redigeringstilgang.
          </p>
        </section>
      )}
    </div>
  );
}
