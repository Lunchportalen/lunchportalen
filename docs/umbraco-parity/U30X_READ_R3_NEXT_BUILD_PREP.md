# U30X-READ-R3 — Next build prep

## Først

1. Verifiser **Postgres** har `content_pages`, `content_page_variants`, og at **tree** ikke returnerer `degraded` i målmiljø.  
2. Verifiser **`content_audit_log`** eller aksepter **degraded** timeline eksplisitt i produkt-kommunikasjon.  
3. Lukk **500**-baner på **intelligence dashboard** og **ESG** hvis de blokkerer backoffice (se runtime-rapport).

## Ikke røre ennå (uten egen instruks)

- Frozen flows i AGENTS.md (superadmin companies, onboarding, system flytsjekk, etc.).  
- Auth/middleware kanon (header, post-login).

## Filer å åpne først neste runde

1. `app/(backoffice)/backoffice/content/page.tsx` — landing vs editor-first.  
2. `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx` — selection vs children.  
3. `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` — state ownership.  
4. `app/api/backoffice/content/tree/route.ts` — degraded paths.  
5. `lib/cms/backofficeExtensionRegistry.ts` — nav IA.  
6. `lib/cms/moduleLivePosture.ts` — ærlig modulstatus.

## Docs å ignorere (til kode er sann)

- Eldre «full parity» påstander uten **STRUCTURAL_GAP** liste.  
- Dok som refererer til **slettede** shell-filer (se git status / DOC_DRIFT rapport).

## Runtime-feil før UX-polish

- Schema/migrasjon for CMS-tabeller.  
- Intelligence `INTEL_LOAD_FAILED`.  
- ESG `ESG_BACKOFFICE_FAILED` (catch-all).

## Raskest UX-løft (uten full replatform)

- Endre **content default route** til **tree-first** eller **siste redigerte side** (produktvalg).  
- Reduser **modal samtidighet** (stack review).

## Subsystemer: UX først vs dyp struktur

| UX polish first | Krever dyp strukturendring |
|-----------------|----------------------------|
| Landing, strip copy, save bar grouping | Extension manifest, workspace context host, footer apps, data types in DB |
