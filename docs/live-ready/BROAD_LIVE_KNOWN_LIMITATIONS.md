# Bred live — kjente begrensninger

**Dato:** 2026-03-29

| Limitation | Impact | Accepted for broad live? | Owner | Follow-up timing |
|------------|--------|---------------------------|-------|------------------|
| Middleware uten full rolle-gating | Feil bruker kan teoretisk nå URL før layout stopper | **Ja**, med vilkår — API/layout som sannhet | Plattform | Ved evt. middleware-prosjekt |
| `strict: false` (TypeScript) | Svakere statisk garanti | **Ja** for nå | Utvikling | Etter RC / egen sak |
| Stor API-flate | Review-byrde ved endringer | **Ja** med disiplin | Utvikling | Kontinuerlig |
| Worker stub-jobs (e-post, AI, eksperiment) | Ikke pålitelig for drift uten videre | **Ja** — ikke forretningskritisk | Plattform | Når produkt krever det |
| Ingen dokumentert lasttest | Ukjent oppførsel ved topp | **Ja** med kontrollert trafikk | Drift + plattform | Før stor kampanje |
| Social ekstern publish avhengig av nøkler | Ingen garantert ekstern effekt | **Ja** med ærlig kommunikasjon | Growth + support | Ved kanal-onboarding |
| Trippel ESG API-overflate | Vedlikehold/forvirring | **Ja** med dokumentasjon | Utvikling | Konsolidering når modent |
| Backup/restore detaljer | Avhenger av Supabase/leverandør-prosedyrer | **Ja** når eier verifiserer | Drift | Pre-go sjekk |
