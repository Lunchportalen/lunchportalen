export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import ServiceAreasManager from "@/components/providers/ServiceAreasManager";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadServiceAreas } from "@/lib/providers/loadServiceAreas";

export default async function LeverandorOmraderPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fomrader");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  const rows = await loadServiceAreas(provider.id);

  return (
    <div className="ds-container ds-provider-service-areas-page">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Dekningsområder</h1>
          <p className="ds-lead">
            Postnummer-intervaller styrer hvilke bedrifter som matches til {provider.name} ved registrering.
          </p>
        </div>
      </header>
      <ServiceAreasManager providerId={provider.id} rows={rows} canEdit={canEdit} />
    </div>
  );
}
