# Bred live — åpne plattform-risikoer

**Dato:** 2026-03-29  
**Kilde:** Sammenstilling av `OPEN_PLATFORM_RISKS.md`, audit/hardening-dokumenter og denne live-ready pass.

| ID | Risiko | Alvor | Mitigasjon i dag | Gjenstår |
|----|--------|-------|------------------|----------|
| A1 | Middleware uten rolle | Høy | Server layouts + API `scopeOr401` / guards | Ev. fremtidig middleware-hardening |
| A2 | Stor API-flate | Middels | CI, kontraktsjekk, tester | Kontinuerlig review |
| A3 | `strict: false` | Middels | Kodereview, tester | Strict-migrering senere |
| B1 | To spor uke (meny vs Sanity) | Middels | Dokumentert | Arkitektonisk eierskap |
| C | Billing hybrid | Høy (økonomi) | Tester, fail-closed der mulig | Manuell økonomi-QA |
| D | Growth (SoMe/SEO/ESG) misforståelse | Høy (tillit) | UI-ærlighet, API DRY_RUN | Salg/support trening |
| E | Worker stubs | Lav (hvis ikke avhengig) | Dokumentasjon | Implementasjon når krav |
| F | Ingen bred lasttest | Middels | Kontrollert utrulling | Load test før stor kampanje |
| G | Backoffice overflate | Middels | Rolle-gates | Penetrasjonstest valgfritt |

**Fail-closed-prinsipp:** Ved tvil — blokker handling, vis trygg read-only UI (jfr. enterprise law i `AGENTS.md`).
