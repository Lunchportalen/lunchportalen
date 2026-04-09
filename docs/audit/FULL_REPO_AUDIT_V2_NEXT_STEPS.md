# FULL REPO AUDIT V2 — Next steps

**Ikke start store refaktorer uten egen instruks.** Dette er **anbefalt rekkefølge** etter V2.

## Umiddelbart (0–2 uker)

1. **Etabler API-eierskap:** Utvid `lib/system/routeRegistry.ts` eller generer liste fra `scripts/audit-api-routes.mjs` — **én** sann tabell for pilot-scope.
2. **Cron review:** For hver `app/api/cron/*` **ikke** i `vercel.json`: merk **ACTIVE / DEPRECATED / MANUAL** i repo (lite notatfil under `docs/ops/` — *kun når team godkjenner*).
3. **Komponent-policy:** Beslutning: «alle nye komponenter i `components/` **eller** `src/components/`» — deretter fjern **duplikater** planlagt.

## Kort horisont (1–3 måneder)

4. **TypeScript strict:** Faset — `strict: true` per pakke/mappe.
5. **Worker:** Implementer eller fjern **stub** job types; mål: ingen «stub» i produksjonsprofil.
6. **ESG API:** Dokumenter **hvorfor** tre lag — eller slå sammen med rolle-sjekk.

## Lang horisont

7. **Rot-doc opprydding:** Flytt policy `.md` til `docs/compliance/` med redirects i indeks.
8. **Dead code pass:** `ts-prune` / `knip` på `lib/` og `app/api` (CI-vennlig).

## Verifikasjon som bør gjentas ved release

- `npm run typecheck`
- `npm run build:enterprise`
- `npm run test:run`
- E2E (`npm run e2e`) — **ikke** kjørt i denne V2-økten; planlegg for pilot.

## Stoppregel

Ingen nye parallelle systemer; ingen `v2`-filer i `app/` uten eksplisitt vedtak.
