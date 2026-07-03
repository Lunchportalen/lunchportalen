export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";

import ProviderMenuTranslationsPanel from "./ProviderMenuTranslationsPanel";

export default async function LeverandorMenyOversettelserPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fmeny%2Foversettelser");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canWrite = await hasProviderRole(auth.user.id, provider.id, "provider_admin");

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Meny</p>
          <h1 className="ds-h2">Menyoversettelser</h1>
          <p className="ds-lead">
            Godkjenn og administrer oversatte menytekster for {provider.name}. Dette påvirker ikke hva
            ansatte ser ennå.
          </p>
        </div>
        <Link href="/leverandor/meny" className="ds-btn">
          Tilbake til meny
        </Link>
      </header>
      <ProviderMenuTranslationsPanel canWrite={canWrite} />
    </div>
  );
}
