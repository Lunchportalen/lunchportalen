import React from "react";
import Link from "next/link";

type Props = {
  status: string | null | undefined;
  children: React.ReactNode;
};

export default function CompanyStatusGate({ status, children }: Props) {
  const s = String(status ?? "").toUpperCase();

  if (s === "ACTIVE") return <>{children}</>;

  if (s === "PENDING") {
    return (
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
        <h1 className="text-xl font-semibold">Avtalen venter på godkjenning</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Bedriften er opprettet, men må godkjennes av superadmin før bestilling og full tilgang aktiveres.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold"
            href="/kontakt"
          >
            Kontakt support
          </Link>
          <Link className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white" href="/admin">
            Oppdater
          </Link>
        </div>
      </div>
    );
  }

  if (s === "PAUSED") {
    return (
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
        <h1 className="text-xl font-semibold">Firma er midlertidig pauset</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Tilgangen er pauset. Ta kontakt hvis du mener dette er feil.
        </p>
        <Link className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white" href="/kontakt">
          Kontakt support
        </Link>
      </div>
    );
  }

  if (s === "CLOSED") {
    return (
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
        <h1 className="text-xl font-semibold">Firma er stengt</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Tilgangen er stengt. Kontakt support dersom dette skal reaktiveres.
        </p>
        <Link className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white" href="/kontakt">
          Kontakt support
        </Link>
      </div>
    );
  }

  // Fail-closed for unknown status
  return (
    <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
      <h1 className="text-xl font-semibold">Tilgang blokkert</h1>
      <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
        Ugyldig eller ukjent firmastatus. Kontakt support.
      </p>
      <Link className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white" href="/kontakt">
        Kontakt support
      </Link>
    </div>
  );
}
