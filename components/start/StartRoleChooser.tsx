"use client";

import { useState } from "react";

import GeographyGateForm from "@/components/start/GeographyGateForm";
import ProviderIntakeForm from "@/components/start/ProviderIntakeForm";

type Role = "business" | "caterer";

type Props = {
  /** Server-resolved: true for ?intent=demo|register or valid geo params. */
  skipRoleGate: boolean;
};

export default function StartRoleChooser({ skipRoleGate }: Props) {
  const [role, setRole] = useState<Role | null>(null);
  const activeRole = role ?? (skipRoleGate ? "business" : null);

  if (activeRole === null) {
    return (
      <>
        <header className="lp-start-card__header">
          <h1 id="start-page-title" className="lp-start-card__title font-heading">
            Kom i gang med Lunchportalen
          </h1>
          <p className="lp-start-card__lead font-body">
            Velg hva som passer deg — vi hjelper deg videre med neste steg.
          </p>
        </header>

        <div className="lp-start-choices lp-start-step" role="group" aria-label="Velg din rolle">
          <button
            type="button"
            className="lp-start-choice lp-start-choice--business"
            onClick={() => setRole("business")}
          >
            <span className="lp-start-choice__icon" aria-hidden="true">
              B
            </span>
            <span className="lp-start-choice__title">Jeg ønsker lunsj til bedriften</span>
            <span className="lp-start-choice__body">
              Finn caterere i ditt område og kom i gang med firmalunsj uten matsvinn.
            </span>
            <span className="lp-start-choice__cta">Finn caterere →</span>
          </button>

          <button
            type="button"
            className="lp-start-choice lp-start-choice--caterer"
            onClick={() => setRole("caterer")}
          >
            <span className="lp-start-choice__icon" aria-hidden="true">
              C
            </span>
            <span className="lp-start-choice__title">Jeg er caterer</span>
            <span className="lp-start-choice__body">
              Bli leverandør i Lunchportalen og få kontroll på produksjon, levering og kunder.
            </span>
            <span className="lp-start-choice__cta">Meld interesse →</span>
          </button>
        </div>
      </>
    );
  }

  if (activeRole === "caterer") {
    return <ProviderIntakeForm onBack={skipRoleGate ? undefined : () => setRole(null)} />;
  }

  return (
    <>
      <header className="lp-start-card__header">
        <h1 id="start-page-title" className="lp-start-card__title font-heading">
          Hvor holder bedriften til?
        </h1>
        <p className="lp-start-card__lead font-body">
          Fortell oss hvor dere er, så finner vi caterere som leverer lunsj til dere.
        </p>
      </header>

      {!skipRoleGate ? (
        <button type="button" className="lp-start-back" onClick={() => setRole(null)}>
          ← Tilbake til valg
        </button>
      ) : null}

      <GeographyGateForm />
    </>
  );
}
