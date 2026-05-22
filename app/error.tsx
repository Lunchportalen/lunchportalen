"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function RootError({
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
    <main className="ds-page ds-empty-state">
      <div className="ds-container">
        <div className="ds-text-limit ds-empty-state__limit">
          <div className="ds-empty-state__panel ds-fade-up" role="alert">
            <div className="ds-empty-state__icon-wrap" aria-hidden="true">
              <AlertCircle />
            </div>

            <p className="ds-eyebrow">Feil</p>

            <h1 className="ds-h2">Noe gikk galt</h1>

            <p className="ds-lead">
              Vi har logget feilen og vil undersøke. Du kan prøve igjen, eller gå tilbake til forsiden.
            </p>

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
  );
}
