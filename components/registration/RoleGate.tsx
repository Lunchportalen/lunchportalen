"use client";

import type { ReactNode } from "react";

type RoleGateProps = {
  onSelectCompanyAdmin: () => void;
  companyAdminDisabled?: boolean;
  children?: ReactNode;
};

/**
 * RoleGate
 *
 * Minimal, mobile-first gate for offentlig registrering.
 * - Én primær handling: start som bedriftsadministrator.
 * - Fail-closed: hvis deaktivert, viser kun forklarende tekst.
 */
export default function RoleGate({ onSelectCompanyAdmin, companyAdminDisabled = false, children }: RoleGateProps) {
  return (
    <section className="lp-registration-page">
      <div className="lp-registration-inner">
        <div className="lp-registration-card">
          <p className="lp-registration-eyebrow">For bedrifter</p>
          <h1 className="lp-registration-title">Kom i gang med Lunchportalen</h1>
          <p className="lp-registration-lead">
            Samle firmalunsj, ansatte og bestillingsfrister i én rolig arbeidsflate. Start registreringen som
            bedriftsadministrator, så kan ansatte og lokasjoner legges til etterpå.
          </p>

          <div className="lp-registration-actions">
            <button
              type="button"
              onClick={companyAdminDisabled ? undefined : onSelectCompanyAdmin}
              disabled={companyAdminDisabled}
              className="lp-registration-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start som bedriftsadministrator
            </button>

            <p className="lp-registration-note">
              For firma-admin. Ansatte logger inn med eksisterende konto når bedriften er klar.
            </p>

            {companyAdminDisabled ? (
              <p className="lp-registration-note">
                Registrering for nye bedriftskunder er midlertidig stengt. Ta kontakt med oss dersom du har spørsmål.
              </p>
            ) : null}
          </div>

          <div className="lp-registration-pills" aria-label="Fordeler">
            <span className="lp-registration-pill">Mindre manuelt arbeid</span>
            <span className="lp-registration-pill">Full kontroll</span>
            <span className="lp-registration-pill">Bestilling før kl. 08:00</span>
          </div>

          {children ? <div className="mt-6 text-xs text-[rgb(var(--lp-muted))]">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

