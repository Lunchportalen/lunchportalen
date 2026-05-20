// app/leverandor/kunder/ny/page.tsx — skeleton (Patch 13)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";

export default function LeverandorNyKundePage() {
  return (
    <div className="ds-container">
      <h1 className="ds-h2">Legg til kunde</h1>
      <p className="ds-lead">Registrering av nye kunder kommer i Patch 13.</p>
      <Link href="/leverandor/kunder" className="ds-btn ds-btn--secondary">
        Tilbake til kunder
      </Link>
    </div>
  );
}
