# Pilot known limitations — acceptance (G0)

**Dato:** 2026-03-29  
**Bruk:** Fyll inn **Owner** og **Ja/Nei** før signoff. «Accepted?» krever bevisst ja — ikke default.

| Limitation | Impact | Accepted for pilot? | Owner | Follow-up after pilot |
|------------|--------|---------------------|-------|------------------------|
| `strict: false` (`tsconfig.json`) | Skjulte typefeil i kanttilfeller | | CTO / Tech lead | Gradvis `strict: true` |
| Middleware uten rolle — API autoritativ | Feil én rute → potensielt lekkasje | | Security-aware lead | API review top routes |
| ~561 `route.ts` — urevidert helhet | Stor angrepsflate | | Product + Tech | API inventory / owners |
| Worker stubs (e-post, AI, experiment) | Ingen reell effekt fra disse jobbene | | Ops | Implementer eller disable |
| Social publish dry-run / stub kanaler | Ingen garantert ekstern post | | Marketing / Content | Nøkler + kanalpolicy |
| SEO «live» uten menneskelig publish-disiplin | Feil forventning | | Content | Prosess + ev. tooling |
| ESG tom data vs kommunikasjon | Feiltolkning «grønt» | | Commercial | Copy review |
| To spor ukeplan (Sanity vs meny) | Desynk risiko | | Product | Arkitekturvalg |
| Ingen dokumentert lasttest | Ukent kapasitet ved pigg | | Ops | Load test på målark |
| Trippel ESG API (admin/backoffice/superadmin) | Vedlikehold/forvirring | | Tech | Konsolidering |
| Backup: ingen app restore-knapp | Avhengig av Supabase leverandør | | Ops | Restore drill |
| `src/components` skygger `components` | Feil import ved refaktor | | Frontend lead | Konsolidering |
| Cron-ruter utenom Vercel 9 | Kan eksistere som manuelt/legacy | | Ops | Dokumenter aktive |

**Avslag:** Hvis **Owner** ikke kan akseptere en rad som er kritisk for pilot (f.eks. SoMe uten ekte publish), må scope justeres — ikke overstyre med «vi prøver».
