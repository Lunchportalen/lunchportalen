import Link from "next/link";
import { Ban } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InactiveAgreementPage() {
  return (
    <main className="ds-page ds-empty-state">
      <div className="ds-container">
        <div className="ds-text-limit ds-empty-state__limit">
          <div className="ds-empty-state__panel ds-fade-up" role="alert">
            <div className="ds-empty-state__icon-wrap" aria-hidden="true">
              <Ban />
            </div>

            <p className="ds-eyebrow">Tilgang stoppet</p>

            <h1 className="ds-h2">Avtalen er ikke aktiv</h1>

            <p className="ds-lead">
              Vi finner ikke en aktiv lunsjavtale for firmaet ditt akkurat nå. Logg inn på nytt, eller kontakt administrator
              dersom dette ikke stemmer.
            </p>

            <div className="ds-empty-state__actions">
              <Link href="/login" className="ds-btn ds-btn--primary">
                Gå til innlogging
              </Link>
              <Link href="/" className="ds-btn ds-btn--secondary">
                Til forsiden
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
