# U17 — Parity gap map

**Tolking av kolonner:** *Gap to Umbraco-17 parity* = mot referanse **Umbraco 17 LTS**-nivå (workflow, modenhet, enterprise-følelse), ikke identisk .NET-implementasjon.

| Capability | Current state | Repo evidence | Gap to Umbraco-17 parity | Planned build action | Risk |
|------------|---------------|---------------|---------------------------|----------------------|------|
| Sections | **Sterk** — grupperte nav, seksjons-IA | `lib/cms/backofficeNavItems.ts`, `BackofficeShell` | Mer «moden LTS»-labling konsistent på tvers | Iterativ copy/IA; ingen ny shell | Lav |
| Dashboards | **Delvis** — startsider per område | `app/(backoffice)/backoffice/**/page.tsx` | Mer samlet dashboard-narrativ | Dokumentert i U17; valgfri KPI-kort senere | Medium |
| Workspaces | **Sterk** — `BackofficeWorkspaceSurface` | CP11/CP12, `components/backoffice/` | Finjustering editorforutsigbarhet | Samme surface; ingen v2 | Lav |
| Content apps | **Sterk** — paneler/kontekst | Content workspace panels, CP11 content apps docs | Dypere kobling dokument-type ↔ panel | Fortsett eksisterende modell | Lav |
| Content tree | **Sterk** | `ContentTree`, tree APIs | Ingen full Umbraco-indeks | Behold; ev. ytelse senere | Lav |
| Media workflow | **God** | `backoffice/media`, API routes | Global media-fulltext mangler | Valgfritt søk; discovery via palett | Medium |
| Property-editor experience | **God** | `blockFieldSchemas`, editors | Tydeligere «publish-kritisk» merking | U17_PROPERTY_EDITOR_PARITY.md | Medium |
| Preview | **God** | preview routes, workspace | Konsistent preview-språk på tvers | UX-copy; samme forståelse som publish | Medium |
| Publish | **God** — eksisterende motor | `app/api/backoffice/content/**` | Ingen global publish-tidslinje | Ærlig UI; ikke falsk én motor | Medium |
| History/versioning | **UX harmonisert, teknisk splittet** | CP12 strip, Postgres vs Sanity | Én teknisk tidslinje | Produktbeslutning; ikke snike inn i U17 | Høy |
| Rollback story | **Delvis** — domeneavhengig | CP11 rollback decision | Full rollback ikke overalt | Ærlig UI; bruk eksisterende spor | Medium |
| Backoffice consistency | **Sterkere enn CP8** | CP11/CP12 refactors | Fortsett 2A/2A design tokens | Kun innen eksisterende shell | Lav |
| Accessibility / editor predictability | **Delvis** | WCAG-mønster der brukt | Systematisk a11y pass | Egen hardening-fase | Medium |
| Company/customer/agreement/location control plane | **Runtime-sannhet** | `lib/**`, admin routes | CMS som **lesing/review** ikke ny sannhet | U17_DOMAIN_AND_TOWER_PARITY.md | Medium |
| Week/menu publish | **Ærlig to-spor** | `week-menu`, Sanity broker | Mer «native» følelse uten ny menymotor | UX + docs; samme kilde | Medium |
| Company admin tower | **Egen** `/admin` | `app/admin/**` | Kobling til **én** kontroll-fortelling | Lenker/IA fra CMS der tillatt | Lav |
| Kitchen tower | **Egen** | `app/kitchen/**` | Status synlig fra CMS posture | Read-only bridge | Lav |
| Driver tower | **Egen** | `app/driver/**` | Samme | Samme | Lav |
| Superadmin tower | **Egen** | `app/superadmin/**` | Frosset flows — ikke bland logikk | Kun navigasjon/discovery | Lav |
| Social module | **Posture** | `lib/social/**`, scripts | LIMITED mulig | Ærlig UI + governance | Medium |
| SEO module | **God** | SEO scripts, panels | Mer CMS-innebygd forklaring | AI/SEO panels eksisterende | Lav |
| ESG module | **Lesing** | ESG routes | Full redaksjonell eierskap vs runtime | Dokumentert grense | Medium |
| Runtime-status / module posture | **Delvis** | RC flags, callouts | Full synlighet LIMITED/STUB | U17_HARDENING.md | Medium |
| Permissions / role experience | **Server-sannhet** | layouts, `lib/auth` | Ikke «Umbraco granular permissions» | Dokumentert replatform-gap | Medium |
| Ops/runbook support | **Delvis** | docs, `docs/hardening` | Sentral runbook | U17_NEXT_STEPS | Medium |
| AI governance | **Script + mønstre** | `ai-governance-check`, API routes | Full cost dashboard | Operativt; ikke blokkert av U17 | Medium |
| AI modularity | **God** — mange routes | `app/api/backoffice/ai/**` | Konfigurerbarhet i UI | Fremtidig settings surface | Medium |
| AI approval model | **Delvis** — workflow/ review i content | `useContentWorkspaceWorkflow` | Eksplisitt «human gate» overalt | Dokumentert; ikke ny orchestrator | Medium |
| AI provider flexibility | **Intent** | env, provider checks | Ingen vendor lock narrative i kode | Fortsett `check:ai-internal-provider` | Lav |
| AI cost / control posture | **Delvis** | usage logging der implementert | Forutsigbar kost som Umbraco marketing | Budsjett/ops utenfor ren CMS | Medium |
