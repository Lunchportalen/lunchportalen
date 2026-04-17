/**
 * U21 — Eksplisitt read-only policyflate (Umbraco AI-lignende governance — ingen hemmeligheter, ingen mutasjon).
 */
export function AiGovernancePolicyPanel() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Policy & kontrollplan (read-only)</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Dette er den operative intensjonen for AI i Lunchportalen — teknisk håndheving skjer via env, API-lag og
        eksisterende workflow. Endringer i policy som krever ny sannhet i databasen er ikke en del av denne flaten.
      </p>
      <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-700">
        <li>
          <strong className="font-medium text-slate-900">Modulært:</strong> hver AI-kapabilitet er en egen rute/kapabilitet —
          ingen skjult «én stor» orkestrator i klienten.
        </li>
        <li>
          <strong className="font-medium text-slate-900">Valgfritt:</strong> kan være av ved manglende/ugyldig konfigurasjon —
          se status over.
        </li>
        <li>
          <strong className="font-medium text-slate-900">Review-first:</strong> synlig innhold som påvirker publikum skal
          gjennom innholdsworkspace / godkjent flyt der det er påkrevd.
        </li>
        <li>
          <strong className="font-medium text-slate-900">Leverandør og modell:</strong> styres sikkert på server — vises som
          lesbar status, ikke som redigerbare felt her.
        </li>
        <li>
          <strong className="font-medium text-slate-900">Kost:</strong> faktisk forbruk følger API-kall og miljø; detaljert
          kostdashbord er operativt, ikke nødvendigvis egen CMS-fane.
        </li>
        <li>
          <strong className="font-medium text-slate-900">Modulposture:</strong> se tabellen under for faktisk driftstilstand
          (LIVE / LIMITED / DRY_RUN / …).
        </li>
      </ul>
    </section>
  );
}
