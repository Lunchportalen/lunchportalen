/**
 * U19 — AI governance UI: human approval, kostbevissthet og leverandørfleksibilitet (forklaring — ingen hemmeligheter).
 */
export function AiGovernanceHumanAndCostPanel() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Human approval</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          AI skal ikke erstatte publish-kontroll. Innhold som påvirker publikum går gjennom{" "}
          <strong className="font-medium text-slate-800">content workspace</strong> og eksisterende workflow der det er
          påkrevd — samme prinsipp som Umbraco AI (menneske i løkken).
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Kost & leverandør</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Kost følger faktisk API-bruk og miljøkonfigurasjon. Leverandør velges operativt (env) — ingen tvungen
          ene-leverandør i produksjonskode; CI sjekker utilsiktet intern provider. Detaljert kost-dashbord er{" "}
          <strong className="font-medium text-slate-800">operativt</strong>, ikke egen CMS-fane i denne fasen.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
        <h2 className="text-sm font-semibold text-slate-900">Konfigurasjon (kontrollplan)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Modell og nøkler konfigureres i <strong className="font-medium text-slate-800">sikre miljøvariabler</strong> og
          i eksisterende API-lag — ikke i klienten. Endringer krever deploy/restart. For konkrete nøkler: se drift
          runbook / `.env` (ikke eksponert her).
        </p>
      </section>
    </div>
  );
}
