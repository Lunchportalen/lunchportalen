# RISK_REGISTER

| ID | Risiko | Sannsynlighet | Konsekvens | Eksponert område | Trigger | Mitigering | Status |
|----|--------|---------------|------------|------------------|---------|------------|--------|
| R1 | **Heap OOM ved `next build`** på standard Node-minne | Medium (miljøavhengig) | **Høy** — blokkerer deploy/lokal verifisering | Hele app-bundlet | Stor kodebase + optimering | `NODE_OPTIONS=--max-old-space-size=...`; modulær splitting; CI dokumenterer minne | **Åpen** (reprodusert lokalt: exit 134) |
| R2 | **Duplikat route-fil** `superadmin/system/repairs/run/route.ts` vs `app/api/...` | — | — | — | — | Rot-fil **slettet** (2026-03-27); cron importerer `app/api/superadmin/...` | **Løst** |
| R3 | **God-component editor** (`ContentWorkspace.tsx` ~6401 linjer) | Høy | **Høy** — regressions, umulig review, treg utvikling | CMS/backoffice | Enhver feature i editor | Aggressiv oppdeling; domain hooks; feature flags | **Åpen** |
| R4 | **314 API-ruter** — stor angrepsflate og inkonsistens | Medium | **Høy** — authz-bugs, kontraktavvik | `app/api/**` | Ny rute uten mal | `audit:api` i CI; intern API-konsolidering | **Delvis mitigert** (audit scripts) |
| R5 | **`lib/ai` 295 filer** — parallel plattform | Høy | **Høy** — drift, kost, kognitiv last | AI/autonomy | Nye agenter/jobs | Arkitektur-gjerder; modulær nedstengning | **Åpen** |
| R6 | **JSONB-innhold uten streng schema-overalt** | Medium | **Medium** — data drift, ugyldige tilstander | `global_content`, page bodies | Editor lagrer partial objects | Zod ved skrivekant + DB constraints | **Delvis** |
| R7 | **`global_content` RLS: authenticated kan INSERT/UPDATE/DELETE med `USING (true)`** | Lav–Medium (avhengig av API-guards) | **Kritisk** hvis klient kobler direkte mot Supabase | Postgres RLS | Direkte klientkall | Verifiser at **kun** service role / sikre RPC brukes fra app | **Krever sikkerhetsreview** (policy i migrering) |
| R8 | **Sanity studio deprecations / duplikat** (`studio/lunchportalen-studio/DEPRECATED.md`) | Medium | **Medium** — feil dokumentasjon, feil deploy | `studio/` | Uklar onboarding | Én dokumentert studio-path | **Åpen** |
| R9 | **Tester med `@ts-nocheck` / `any`** svekker kontrakttillit | Medium | **Medium** — falsk trygghet | `tests/cms/publicPreviewParity.test.ts` m.fl. | Refactor | `publicPreviewParity.test.ts` uten `@ts-nocheck` (2026-03-27); andre filer (f.eks. `publishFlow.test.ts`) gjenstår | **Delvis løst** |
| R10 | **`sanity:live` soft-gate** når localhost nede | Lav i prod | **Medium** i CI hvis misforstått | Release scripts | Manglende URL | Dokumenter at krever kjørende app for hard gate | **Forventet adferd** (script output) |
| R11 | **`lint:ci` maskerer lint-feil** (`next lint \|\| exit 0`) | — | — | — | — | `lint:ci` er nå **`next lint`** (samme som `lint`) — 2026-03-27 | **Løst** |
| R12 | **E2E ikke kjørt** i denne auditen | — | **Medium** — ukjente regressions | `e2e/` | — | Kjør CI e2e workflow | **Ikke verifisert** |

### Merknad R7 (RLS)

Migrering `20260421000000_global_content.sql` har `authenticated` **INSERT/UPDATE/DELETE** med `USING (true)` / `WITH CHECK (true)`. Dette er **ikke** automatisk feil hvis all skriving skjer via **server-only service role** og klient aldri skriver direkte — men det er **høy risiko** hvis noen eksponerer anon/authenticated direkte skriveklient. **Må verifiseres** mot faktisk klientbruk.
