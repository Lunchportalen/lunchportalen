# LIVE READY — Must-fix matrix

**Dato:** 2026-03-29  
**Regel:** «Smallest safe fix» = minimal endring; **Action now?** = om det ble gjort i denne leveransen eller avventer eier.

| Item | Current state | Why not broad-live-ready | Smallest safe fix | Risk if left open | Action now? |
|------|---------------|--------------------------|-------------------|-------------------|-------------|
| Middleware uten rolle | Cookie på sider | Feil API-rute kan lekke | Fortsett API `scopeOr401`; dokumenter | Lekkasje | **Doc** + prosess; **ikke** middleware-refaktor i denne fasen |
| APIflate ~561 ruter | Ikke alle revidert | Inkonsistent gate | Pilot/bred **prefix-allowlist** operativt | Exploit surface | **Doc**; bred refaktor **nei** |
| `strict: false` | Type-hull | Runtime-feil | Gradvis strict — **annen fase** | Produksjonsfeil | **Nei** (ute av scope) |
| Worker e-post/AI/experiment | Stub | Ingen reell effekt | Disable kø eller dokumenter **OUT** | Feil forventning | **Doc** (`STUB`) |
| Social ekstern publish | Dry-run mulig | «Publisert» kan være intern only | **UI-tekst** om dry-run | Tillitsbrudd | **Ja** — se `SocialCalendarRuntimeClient` |
| Trippel ESG API | Tre lag | Feil API-valg per rolle | Dokumenter hvilken rute per rolle | Feil data | **Doc** |
| To spor ukeplan | B1 åpen | Desynk | Arkitekturvalg — **stor** | Feil menyuke | **Nei** — eksplisitt **post** |
| Lasttest | Mangler | Ukent kapasitet | Lasttest i eget løp | Nedetid | **Nei** |
| Cron utenom Vercel 9 | Mange filer | Forvirring | Dokumenter INTERNAL | Feil trigger | **Doc** |
| Billing hybrid | Kompleks | Feil fakturaforventning | Økonomi-QA | Pengefeil | **Doc** + eier Finance |
| `src/components` alias | Skygger `components` | Feil import ved refaktor | Policy — **senere** | Byggfeil | **Nei** |

**Konklusjon:** Ingen **bred refaktor** kreves for å *beskrive* bred live; de fleste rader er **dokumentasjon + eierskap**. Én **UI**-presisjon for social er gjennomført som minste grep.
