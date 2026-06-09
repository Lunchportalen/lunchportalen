"use client";

import { useState } from "react";

import GeographyGateForm from "@/components/start/GeographyGateForm";
import ProviderIntakeForm from "@/components/start/ProviderIntakeForm";

type Role = "business" | "caterer";

type Props = {
  /** Server-resolved: true for ?intent=demo|register or valid geo params. */
  skipRoleGate: boolean;
};

const TRUST_POINTS = [
  "Ingen forpliktelser",
  "Riktig flyt fra start",
  "For bedrifter og caterere",
] as const;

export default function StartRoleChooser({ skipRoleGate }: Props) {
  const [role, setRole] = useState<Role | null>(null);
  const activeRole = role ?? (skipRoleGate ? "business" : null);

  if (activeRole === null) {
    return (
      <div className="lp-start-gate lp-start-step" aria-labelledby="start-page-title">
        <div className="lp-start-gate__intro">
          <p className="lp-start-eyebrow">Start</p>
          <h1 id="start-page-title" className="lp-start-gate__title font-heading">
            Hva ønsker du å gjøre?
          </h1>
          <p className="lp-start-gate__lead font-body">
            Finn firmalunsj til bedriften – eller bli leverandør på plattformen. Vi hjelper deg videre med
            riktig flyt.
          </p>
          <ul className="lp-start-trust" aria-label="Dette kan du forvente">
            {TRUST_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div className="lp-start-gate__paths" role="group" aria-label="Velg din rolle">
          <button
            type="button"
            className="lp-start-path lp-start-path--business"
            onClick={() => setRole("business")}
          >
            <span className="lp-start-path__kicker">For bedrifter</span>
            <span className="lp-start-path__subtitle">Jeg ønsker lunsj til bedriften</span>
            <p className="lp-start-path__text">
              Finn caterere som leverer til deres område. Ansatte bestiller selv, og bedriften får bedre
              kontroll på lunsjflyten.
            </p>
            <span className="lp-start-path__cta">Finn caterere nær oss</span>
          </button>

          <button
            type="button"
            className="lp-start-path lp-start-path--caterer"
            onClick={() => setRole("caterer")}
          >
            <span className="lp-start-path__kicker">For caterere</span>
            <span className="lp-start-path__subtitle">Jeg er caterer</span>
            <p className="lp-start-path__text">
              Bli leverandør på Lunchportalen og få en strukturert flyt for avtaler, bestillinger, cutoff og
              produksjonsgrunnlag.
            </p>
            <span className="lp-start-path__cta">Meld interesse som caterer</span>
          </button>
        </div>
      </div>
    );
  }

  if (activeRole === "caterer") {
    return (
      <div className="lp-start-panel lp-start-step">
        <ProviderIntakeForm onBack={skipRoleGate ? undefined : () => setRole(null)} />
      </div>
    );
  }

  return (
    <div className="lp-start-panel lp-start-step">
      <header className="lp-start-panel__header">
        <h1 id="start-page-title" className="lp-start-panel__title font-heading">
          Hvor holder bedriften til?
        </h1>
        <p className="lp-start-panel__lead font-body">
          Fortell oss hvor dere er, så finner vi caterere som leverer lunsj til dere.
        </p>
      </header>

      {!skipRoleGate ? (
        <button type="button" className="lp-start-back" onClick={() => setRole(null)}>
          ← Tilbake til valg
        </button>
      ) : null}

      <GeographyGateForm />
    </div>
  );
}
