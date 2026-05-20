export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import { getSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";
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

  const studioUrl = getSanityStudioBaseUrl();

  return (
    <div className="ds-container ds-provider-meny-page">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Meny</h1>
          <p className="ds-lead">Meny og ukens retter administreres i Sanity Studio — én sannhetskilde for innhold.</p>
        </div>
      </header>

      <section className="ds-card ds-provider-meny-card">
        <h2 className="ds-h3">Sanity Studio</h2>
        <p className="ds-body">
          Lunchportalen henter meny fra Sanity. Som leverandør redigerer du <strong>menuDay</strong> og relatert
          innhold i Studio, filtrert på din provider.
        </p>
        <ol className="ds-provider-meny-steps">
          <li>Åpne Sanity Studio (ny fane).</li>
          <li>Finn dokumenttypen <strong>Menydag (menuDay)</strong>.</li>
          <li>Velg riktig dato og provider — publiser når uken er klar.</li>
        </ol>
        <p className="ds-body">
          Endringer i Studio synkroniseres til portalen etter publisering. Det finnes ingen separat in-app
          meny-editor i leverandørportalen.
        </p>
        <a
          href={studioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ds-btn ds-btn--primary"
        >
          Åpne Sanity Studio
        </a>
      </section>
    </div>
  );
}
