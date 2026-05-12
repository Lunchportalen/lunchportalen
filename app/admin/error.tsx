// app/admin/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Minimal logging (unngå sensitive data)
    console.error("[ADMIN_ERROR_BOUNDARY]", {
      message: error?.message,
      digest: error?.digest ?? null,
    });
  }, [error]);

  return (
    <div className="ds-admin-error">
      <h1 className="ds-admin-error__title">Det oppstod en feil i admin</h1>

      <p className="ds-admin-error__body">
        Systemet er oppe, men denne visningen fikk en uventet feil.
        Du kan forsøke å laste siden på nytt.
      </p>

      <div className="ds-admin-error__actions">
        <button
          type="button"
          onClick={() => reset()}
          className="ds-admin-error__button"
        >
          Last på nytt
        </button>

        <Link
          href="/admin"
          className="ds-admin-error__link"
        >
          Tilbake til dashboard
        </Link>
      </div>

      <div className="ds-admin-error__tech">
        <div className="ds-admin-error__tech-title">Teknisk informasjon</div>

        <div className="ds-admin-error__tech-body">
          <div>
            <strong>Melding:</strong>{" "}
            {error?.message || "Ingen feilmelding tilgjengelig"}
          </div>

          {error?.digest ? (
            <div>
              <strong>Digest:</strong> {error.digest}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
