export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import ProviderCapacityPanel from "@/components/providers/ProviderCapacityPanel";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";

export default async function LeverandorKapasitetPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fkapasitet");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  const canView =
    canEdit ||
    (await hasProviderRole(auth.user.id, provider.id, "provider_viewer")) ||
    (await hasProviderRole(auth.user.id, provider.id, "provider_kitchen"));
  if (!canView) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">Kapasitet</h1>
        <p className="ds-body">Du har ikke tilgang til kapasitet for denne leverandøren.</p>
      </div>
    );
  }

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Kapasitet</h1>
          <p className="ds-lead">
            Sett ubegrenset, begrenset eller stengt kapasitet for {provider.name}. Booket og frigitt
            antall er synlig per dag.
          </p>
        </div>
      </header>
      {canEdit ? (
        <ProviderCapacityPanel />
      ) : (
        <p className="ds-body">Kun lesetilgang. Be en leverandøradmin om å endre kapasitet.</p>
      )}
    </div>
  );
}
