# Phase 2C0 — Superadmin runtime plan (control tower)

**Rolle:** `superadmin` — full systemtilgang; må ikke bryte **frosne** flater (AGENTS.md A1.x, spesielt firma-livsløp, system/flytdiagnostikk, onboarding-validering).

## 1. Innganger i repoet i dag

| Inngang | Beskrivelse |
|---------|-------------|
| `/superadmin` | `SuperadminControlCenter` — kort grid fra `lib/superadmin/capabilities.ts` |
| **capabilities** | Én kilde til lenker gruppert: `core`, `operations`, `growth`, `system` |

**Viktig:** Mange kort peker på **ekte** App Router-sider; noen overflateområder kan være eksperimentelle — verifiser per side før «tower»-klassifisering.

## 2. Kjerneområder vs planlagte funksjoner

| Område | Rute(r) / API (eksempler) | Realitet i dag (høy nivå) |
|--------|----------------------------|----------------------------|
| **Pending / godkjenning** | `superadmin/agreements`, API `approve` / `reject` / `activate` | Avtaleflyt med livssyklus — **sensitiv** |
| **Selskaper** | `/superadmin/companies`, `/superadmin/firms`, `companies/set-status`, `company/[id]/activate` | **Frosset** flyt per AGENTS P16 — minimal endring |
| **Avtaler** | `agreements`, `agreements/[id]`, relaterte API | Kjerne for B2B |
| **Brukere** | `/superadmin/users`, API `users/*`, disable/delete/enable/cleanup | **Høy risiko** |
| **Drift / status** | `/superadmin/system`, `/superadmin/overview`, `api/superadmin/system`, `system-graph` | System-sannhet — **ikke** endre klassifisering OK/WARN/FAIL i flytsjekk |
| **Stenging / status** | `companies/set-status`, avtaler pause/reject | Global påvirkning |

### Control tower API (superadmin)

Under `app/api/superadmin/control-tower/**` finnes flere ruter (`data`, `snapshot`, `golive`, `scale`, osv.). Disse er **operativt/konseptuelle** — må kartlegges mot faktisk produktbehov; ikke anta at alle er produksjonskritiske uten review.

## 3. Halvferdige / demo-aktige spor (risiko)

- **Growth / AI / eksperimenter** i `capabilities` — kan være riktige verktøy eller «wide» overflater; skill **operativ drift** fra **CMS/vekst** i tower-planen.
- **Pipeline, sales-loop, investor** — verifiser mot reell bruk før de blandes med kjernedrift.

## 4. Source of truth (superadmin)

| Område | Sannhet |
|--------|---------|
| Firmaliste / livsløp | Eksisterende `superadmin/companies` + API — **én** mutasjonsinngang |
| Avtaler | `superadmin/agreements` + godkjennings-API |
| Systemhelse | `/superadmin/system` — env/runtime som autoritet |
| Brukere globalt | `superadmin/users` + API — ingen «skjult» duplikat-admin |

## 5. Mest sensitive mutasjoner (prioritet for restriksjon / audit)

1. Aktivering / deaktivering av selskap og avtaler  
2. Bruker disable/delete/cleanup  
3. Faktura/billing-eksport som påvirker økonomi  
4. Alt som endrer onboarding-kø eller pending uten idempotens  

## 6. Anbefalt retning (plan)

1. **Inventer** hver `capabilities.href` → { formål, API-kilde, prod-klar ja/nei }.  
2. **Skille** «operativ tower» (kjerner + drift) fra «growth/backoffice» i dokumentasjon og navigasjon — ikke nye ruter i 2C0.  
3. **Superadmin siste** i implementasjonssekvens (se `PHASE2C_IMPLEMENTATION_SEQUENCE.md`) pga. blast radius.  
4. Respekter **frosne** audit- og flytsjekk-regler — kun tekst/UI der loven tillater.

## 7. Tester (referanse, utvid senere)

- `tests/api/superadmin.agreements-lifecycle.test.ts`
- `tests/api/superadmin-system-status.test.ts`
- `tests/tenant-isolation*.test.ts` (der superadmin er implisitt «ser alt» — må ikke svekke tenant-guards for andre roller)
