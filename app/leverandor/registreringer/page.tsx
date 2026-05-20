export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import ProviderRegistrationsQueue from "@/components/providers/ProviderRegistrationsQueue";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderRegistrations } from "@/lib/providers/loadProviderRegistrations";

export default async function LeverandorRegistreringerPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fregistreringer");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const isAdmin = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  if (!isAdmin) redirect("/leverandor");

  const rows = await loadProviderRegistrations(provider.id, "pending");

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Registreringer</h1>
          <p className="ds-lead">Ventende bedrifter som ønsker lunsjordning i ditt dekningsområde.</p>
        </div>
      </header>
      <ProviderRegistrationsQueue providerId={provider.id} rows={rows} />
    </div>
  );
}
