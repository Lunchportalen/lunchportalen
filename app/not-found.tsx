import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="ds-page ds-empty-state">
      <div className="ds-container">
        <div className="ds-text-limit ds-empty-state__limit">
          <div className="ds-empty-state__panel ds-fade-up">
            <div
              className="ds-empty-state__icon-wrap ds-empty-state__icon-wrap--neutral"
              aria-hidden="true"
            >
              <Compass />
            </div>

            <p className="ds-eyebrow">404</p>

            <h1 className="ds-h2">Vi finner ikke siden</h1>

            <p className="ds-lead">
              Siden du leter etter eksisterer ikke eller har blitt flyttet. Sjekk URL-en eller gå tilbake til forsiden.
            </p>

            <div className="ds-empty-state__actions">
              <Link href="/" className="ds-btn ds-btn--primary">
                Til forsiden
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
