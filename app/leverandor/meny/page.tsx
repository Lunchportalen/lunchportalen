export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import { getVerifiedSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";
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

  const studioUrl = getVerifiedSanityStudioBaseUrl();

  return (
    <div className="ds-container ds-provider-meny-page">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Meny</h1>
          <p className="ds-lead">Administrer menyinnholdet som vises for bedriftene dine.</p>
        </div>
      </header>

      {studioUrl ? (
        <section className="ds-card ds-provider-meny-card">
          <h2 className="ds-h3">Menyinnhold redigeres i Sanity Studio</h2>
          <p className="ds-body">
            Lunchportalen bruker Sanity som innholdskilde for ukens retter. Når menyen publiseres, synkroniseres den
            til portalen.
          </p>
          <ol className="ds-provider-meny-steps">
            <li>Åpne menyredigering (åpnes i ny fane).</li>
            <li>Velg <strong>Menydag</strong> og riktig dato.</li>
            <li>Publiser når uken er klar — endringene blir synlige for bedriftene dine.</li>
          </ol>
          <a
            href={studioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-btn ds-btn--primary"
          >
            Åpne menyredigering
          </a>
          <p className="ds-body ds-provider-meny-note">
            Dette er en midlertidig ekstern redigeringsflate. Menyredigering flyttes inn i leverandørportalen.
          </p>
        </section>
      ) : (
        <section className="ds-card ds-provider-meny-card">
          <h2 className="ds-h3">Menyredigering er ikke aktivert i leverandørportalen ennå.</h2>
          <p className="ds-body">
            Lunchportalen bruker Sanity som innholdskilde for ukens retter.
          </p>
          <p className="ds-body">
            Inntil provider-redigering er aktivert, administreres menyinnhold av Lunchportalen.
          </p>
        </section>
      )}
    </div>
  );
}
