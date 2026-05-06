/**
 * U19 — AI governance UI: human approval, kostbevissthet og leverandørfleksibilitet (forklaring — ingen hemmeligheter).
 */
export function AiGovernanceHumanAndCostPanel() {
  return (
    <section className="lp-card p-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <div>
          <h2 className="lp-card-title">Human approval</h2>
          <p className="lp-card-subtitle text-sm">
          AI skal ikke erstatte publish-kontroll. Innhold som påvirker publikum går gjennom{" "}
          <strong className="font-black text-[rgb(var(--lp-text))]">content workspace</strong> og eksisterende workflow der det er
          påkrevd — samme prinsipp som Umbraco AI (menneske i løkken).
          </p>
        </div>
        <div className="border-t border-[rgb(var(--lp-border))]/70 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <h2 className="lp-card-title">Kost & leverandør</h2>
          <p className="lp-card-subtitle text-sm">
          Kost følger faktisk API-bruk og miljøkonfigurasjon. Leverandør velges operativt (env) — ingen tvungen
          ene-leverandør i produksjonskode; CI sjekker utilsiktet intern provider. Detaljert kost-dashbord er{" "}
          <strong className="font-black text-[rgb(var(--lp-text))]">operativt</strong>, ikke egen CMS-fane i denne fasen.
          </p>
        </div>
        <div className="border-t border-[rgb(var(--lp-border))]/70 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <h2 className="lp-card-title">Konfigurasjon</h2>
          <p className="lp-card-subtitle text-sm">
          Modell og nøkler konfigureres i <strong className="font-black text-[rgb(var(--lp-text))]">sikre miljøvariabler</strong> og
          i eksisterende API-lag — ikke i klienten. Endringer krever deploy/restart. For konkrete nøkler: se drift
          runbook / `.env` (ikke eksponert her).
          </p>
        </div>
      </div>
    </section>
  );
}
