// app/leverandor/kunder/ny/page.tsx — skeleton (Patch 13)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";

export default function LeverandorNyKundePage() {
  return (
    <div className="ds-container">
      <h1 className="ds-h2">Legg til kunde</h1>
      <p className="ds-lead">
        Direkte registrering av nye kunder er ikke tilgjengelig ennå. Nye bedrifter i ditt dekningsområde kommer inn
        via Registreringer når de melder interesse.
      </p>
      <Link href="/leverandor/kunder" className="ds-btn ds-btn--secondary">
        Tilbake til kunder
      </Link>
    </div>
  );
}
