export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import ProviderMenuBuilder from "@/components/providers/ProviderMenuBuilder";
import LocaleSwitcher from "@/components/nav/LocaleSwitcher";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";

function roleShortLabel(role: string | null): string {
  if (role === "provider_admin") return "Leverandør-admin";
  if (role === "provider_kitchen") return "Kjøkken";
  return "Leverandør";
}

export default async function LeverandorMenyPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fmeny");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_kitchen");
  const initials = provider.name.slice(0, 2).toUpperCase();

  return (
    <div className="ds-provider-meny-page lp-editor-page">
      <header className="lp-editor-topbar" aria-label="Leverandør toppbar">
        <Link href="/" className="lp-editor-topbar__brand">
          <Image
            src="/brand/LP-logo-uten-bakgrunn.png"
            alt="Lunchportalen"
            width={120}
            height={64}
            className="lp-editor-topbar__logo"
            priority
          />
        </Link>
        <span className="lp-editor-topbar__spacer" aria-hidden="true" />
        <div className="lp-editor-topbar__lang">
          <LocaleSwitcher className="lp-editor-topbar__locale" />
        </div>
        <div className="lp-editor-topbar__who">
          <span className="lp-editor-topbar__avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="lp-editor-topbar__who-text">
            <b>{provider.name}</b>
            <span>{roleShortLabel(ctx.role)}</span>
          </div>
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
