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
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center px-4 py-8">
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-[rgb(var(--lp-text))]">Kom i gang med Lunchportalen</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Registrering gjøres av en bedriftsadministrator. Du kan legge til ansatte og lokasjoner etter at avtalen er
          opprettet.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={companyAdminDisabled ? undefined : onSelectCompanyAdmin}
            disabled={companyAdminDisabled}
            className="inline-flex w-full items-center justify-center rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            Start som bedriftsadministrator
          </button>

        {companyAdminDisabled ? (
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Registrering for nye bedriftskunder er midlertidig stengt. Ta kontakt med oss dersom du har spørsmål.
            </p>
          ) : null}
        </div>

        {children ? <div className="mt-6 text-xs text-[rgb(var(--lp-muted))]">{children}</div> : null}
      </div>
    </div>
  );
}

