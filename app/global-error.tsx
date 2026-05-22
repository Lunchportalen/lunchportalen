"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="nb">
      <body>
        <main className="ds-page ds-empty-state">
          <div className="ds-container">
            <div className="ds-text-limit ds-empty-state__limit">
              <div className="ds-empty-state__panel" role="alert">
                <h1 className="ds-h2">Noe gikk galt</h1>
                <p className="ds-lead">En alvorlig feil oppstod. Prøv igjen, eller gå til forsiden.</p>
                <div className="ds-empty-state__actions">
                  <button type="button" className="ds-btn ds-btn--primary" onClick={() => reset()}>
                    Prøv igjen
                  </button>
                  <Link href="/" className="ds-btn ds-btn--secondary">
                    Til forsiden
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
