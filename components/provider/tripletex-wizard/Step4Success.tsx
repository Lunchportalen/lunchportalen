"use client";

import Link from "next/link";

type Props = {
  companyName: string | null;
};

export default function Step4Success({ companyName }: Props) {
  return (
    <section className="ds-surface" aria-labelledby="tpt-step4-title">
      <p className="ds-eyebrow">Steg 5 av 5</p>
      <h2 id="tpt-step4-title" className="ds-h3">
        ✓ Tripletex er koblet til
      </h2>

      <span className="ds-status-badge ds-status-badge--connected">Tilkoblet</span>

      {companyName ? (
        <p className="ds-body ds-text-limit">Selskap: {companyName}</p>
      ) : null}

      <p className="ds-body ds-text-limit">Du kan nå:</p>
      <ul className="ds-body ds-text-limit">
        <li>Sende fakturaer automatisk til Tripletex</li>
        <li>Motta betalingsstatus via webhook</li>
        <li>Se tilkoblingsstatus og historikk</li>
      </ul>

      <div className="ds-wizard__actions">
        <Link className="ds-btn ds-btn--primary" href="/leverandor/faktura">
          Se faktura-historikk
        </Link>
        <Link className="ds-btn ds-btn--secondary" href="/leverandor/innstillinger/tripletex/status">
          Se tilkoblingsstatus
        </Link>
        <Link className="ds-btn ds-btn--secondary" href="/leverandor/innstillinger">
          Tilbake til oversikt
        </Link>
      </div>
    </section>
  );
}
