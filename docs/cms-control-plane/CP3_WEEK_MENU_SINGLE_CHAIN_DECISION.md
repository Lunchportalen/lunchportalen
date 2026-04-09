# CP3 — Week / menu single chain (beslutning og faktisk kode)

**Dato:** 2026-03-29  
**Status:** Én **operativ** kjede for ansatt-uke; **éng** redaksjonell kjede for `weekPlan` (ikke employee truth).

## 1. Hva employee-runtime faktisk leser i dag

- **`GET /api/week`** (og tilhørende serverlogikk) kombinerer:
  - aktiv avtale / måltidstyper (`company_current_agreement`, `agreement_json` der relevant),
  - Sanity **`menu` / `menuContent`** per måltidstype og dato (via eksisterende fetch-lag, f.eks. `getMenusByMealTypes` / menykonsum i week-flow).
- **Bestilling og ukevisning for ansatt** følger denne kjeden — ikke Sanity `weekPlan` som primær ordre-/menykilde.

## 2. Hva som er «publisert sannhet» i dag

- **Meny for drift:** Tilgjengelighet av meny-dokumenter i Sanity + avtalens måltidstyper bestemmer hva som kan vises/bestilles innenfor eksisterende regler.
- **Innholdssider:** Postgres publish (content workspace) — separat lag, men samme control-plane-fortelling (preview/publish for **sider**).
- **`weekPlan`:** Brukes som **redaksjonell/marketing** spor (policy, kommunikasjon) — **ikke** erklært som samme sannhet som `/api/week` for lunsjbestilling.

## 3. Er Sanity menu/menuContent fortsatt source of truth for meny?

**Ja** for det operative menyinnholdet som konsumeres av week-API-et sammen med avtalen. CMS control plane **styrer** ved å:
- åpne Studio (`getSanityStudioBaseUrl()`),
- vise hvilke måltidsnøkler som har dokumenter (`/backoffice/week-menu`),
- forklare kjeden i `CmsWeekRuntimeStatusPanel`.

Ingen ny menytabell eller parallell kilde er introdusert.

## 4. Er weekPlan editorial-only eller operativ?

**Editorial / separat spor** — merket **LIMITED** i `CONTROL_PLANE_RUNTIME_MODULES` (`weekplan_editorial`). UI på `/backoffice/week-menu` sier eksplisitt at `weekPlan` ikke er primær bestillingskilde.

## 5. Hvordan CMS styrer publisering uten ny menykilde

- Redaktør bruker **Sanity Studio** for meny-dokumenter (eksisterende dokumenttyper).
- Backoffice viser **runtime-kjeden** og **sanity-lesing** — governance gjennom innsikt og Studio-lenker, ikke duplikat CMS-database.

## 6. Preview og publish — samme forståelse

- **Content pages:** Preview/publish i content workspace (Postgres) — kanonisk for **sider**.
- **Meny:** «Publish» er Sanity-siden av dokumentflyt + tilgjengelighet i API; **ikke** bland med side-publish-state i DB.
- Begge er dokumentert i UI slik at redaktør ikke antar én felles knapp for alt.

## 7. Felter / komponenter / ruter CP3 kobler

| Del | Beskrivelse |
|-----|-------------|
| `/backoffice/week-menu` | Forklaring + `CmsWeekRuntimeStatusPanel` + tabell `getMenusByMealTypes` |
| `CmsWeekRuntimeStatusPanel` | Tekstlig kjede + lenke Studio + `/backoffice/domains` |
| `CONTROL_PLANE_RUNTIME_MODULES` | `week` LIVE, `weekplan_editorial` LIMITED |
| `CMS_WEEK_MENU_PUBLISH_CHAIN.md` | Diagram/agreement chain |

## 8. Hva som må vente (unngå dobbel sannhet)

- **Ikke** introdusere en «CMS-only» ukeplan som ansatte leser uten å migrere runtime.
- **Ikke** skrive menydatoer til Postgres som konkurrerer med Sanity uten migreringsbeslutning.
- Eventuell fremtidig sammenslåing krever egen arkitektur-RFC — utenfor CP3.
