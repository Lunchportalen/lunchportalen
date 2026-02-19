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
    <div
      style={{
        padding: 32,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26 }}>
        Det oppstod en feil i admin
      </h1>

      <p style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.5 }}>
        Systemet er oppe, men denne visningen fikk en uventet feil.
        Du kan forsøke å laste siden på nytt.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(0,0,0,0.05)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Last på nytt
        </button>

        <Link
          href="/admin"
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Tilbake til dashboard
        </Link>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 14,
          border: "1px solid rgba(255,0,0,0.25)",
          background: "rgba(255,0,0,0.04)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Teknisk informasjon
        </div>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          <div>
            <strong>Melding:</strong>{" "}
            {error?.message || "Ingen feilmelding tilgjengelig"}
          </div>

          {error?.digest ? (
            <div style={{ marginTop: 6 }}>
              <strong>Digest:</strong> {error.digest}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
