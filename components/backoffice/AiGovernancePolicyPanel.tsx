/**
 * U21 — Eksplisitt read-only policyflate (Umbraco AI-lignende governance — ingen hemmeligheter, ingen mutasjon).
 */
export function AiGovernancePolicyPanel() {
  return (
    <section className="lp-card p-6">
      <h2 className="lp-h2 text-[rgb(var(--lp-text))]">Policy & kontrollplan</h2>
      <p className="lp-lead mt-2 text-sm">
        Dette er den operative intensjonen for AI i Lunchportalen — teknisk håndheving skjer via env, API-lag og
        eksisterende workflow. Endringer i policy som krever ny sannhet i databasen er ikke en del av denne flaten.
      </p>
      <ul className="mt-5 grid gap-3 text-sm text-[rgb(var(--lp-muted))]">
        <li>
          <strong className="font-black text-[rgb(var(--lp-text))]">Modulært:</strong> hver AI-kapabilitet er en egen rute/kapabilitet —
          ingen skjult «én stor» orkestrator i klienten.
        </li>
        <li>
          <strong className="font-black text-[rgb(var(--lp-text))]">Valgfritt:</strong> kan være av ved manglende/ugyldig konfigurasjon —
          se status over.
        </li>
        <li>
          <strong className="font-black text-[rgb(var(--lp-text))]">Review-first:</strong> synlig innhold som påvirker publikum skal
          gjennom innholdsworkspace / godkjent flyt der det er påkrevd.
        </li>
        <li>
          <strong className="font-black text-[rgb(var(--lp-text))]">Leverandør og modell:</strong> styres sikkert på server — vises som
          lesbar status, ikke som redigerbare felt her.
        </li>
        <li>
          <strong className="font-black text-[rgb(var(--lp-text))]">Kost:</strong> faktisk forbruk følger API-kall og miljø; detaljert
          kostdashbord er operativt, ikke nødvendigvis egen CMS-fane.
        </li>
        <li>
          <strong className="font-black text-[rgb(var(--lp-text))]">Modulstatus:</strong> se oversikten for faktisk driftstilstand
          (LIVE / LIMITED / DRY_RUN / …).
        </li>
      </ul>
    </section>
  );
}
