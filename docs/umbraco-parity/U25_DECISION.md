# U25 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- Ship: canonical envelope on **new** page create, optional `body` validation, duplicate allowlist guard, editor transparency for legacy vs envelope.
- Conditions: no claim of DB-persisted document type editor; legacy pages remain until edited; full Umbraco Management parity remains **replatforming** (see `U25_REPLATFORMING_GAPS.md`).

## 2. Hva som er oppnådd

- **CMS** er fortsatt kontrollplan for innholdstre, workspace, publiseringsflyt og AI-flate — ikke operativ ordre-/faktasannhet.
- **Domener** som snakker med CMS: public page render fra lagret variant-body, backoffice editor, publish/workflow routes, week/menu publish chain fortsatt via eksisterende kjedetest (uendret i U25).
- **Ukemeny/ukeplan:** ingen endring av operativ sannhet; editorial weekPlan der den finnes forblir editorial-only.
- **Settings / document types / data types / create options:** code-registry + read-only Settings UI; **ærlig** om at CRUD i DB ikke finnes.
- **Sections/trees/workspaces:** uendret strukturelt; create wizard UX forbedret ved server-aksept av `body`.

## 3. Hva som fortsatt er svakt

- Persisted type system (Umbraco-lignende) mangler.
- Legacy `content_page_variants.body` rader uten `documentType` får ikke server allowlist før de lagres med envelope.
- Moduler med LIMITED / DRY_RUN / STUB avhenger av eksisterende runtime-posture (ikke endret her).

## 4. Hvor nær Umbraco 17 / verdensklasse

- **Arbeidsflyt og governance:** nærmere på envelope + create + allowlist **der det er trygt**.
- **Teknisk identitet:** fortsatt Next.js + Supabase — ikke .NET Management API; se replatforming-gap.

## 5. Før ubetinget enterprise-live-ready (minimalt)

1. Evt. migreringsjobb for legacy body → envelope (eksplisitt godkjent).
2. API-tester for POST create edge cases.
3. Fortsett å holde modulposture ærlig i `/backoffice/runtime` og AI-control.

## 6. Kan vente

- Dynamiske content type filters i database.
- Full entity/bulk action parity med Umbraco.
