# Phase 2C0 — Boundaries (hva som ikke skal røres i 2C0)

## Låst i denne fasen (kun dokumentasjon)

| Område | Filer / mønstre | Grunn |
|--------|-------------------|-------|
| Auth entry / resolver | `middleware.ts`, `app/api/auth/post-login/route.ts`, `lib/auth/getAuthContext.ts` | Enterprise law; login-løkker |
| Onboarding complete | `POST` onboarding-complete flyter | Frosset A1.5 |
| Employee operativ sannhet | `/week`, weekPlan-runtime, ordre-vindu for ansatt | Eksplisitt krav |
| Billing motor | Kjerne fakturering / 14-dagers logikk | Kun planlegging — ikke endre motor i 2C0 |
| Supabase / Vercel oppsett | Infra | Utenfor scope |

## Kan leses, ikke endres uten egen change-set

| Område | Merknad |
|--------|---------|
| `lib/http/routeGuard`, `jsonOk` / `jsonErr` | Alle tower-API-er skal følge kontrakt |
| `loadAdminContext`, `getAuthContext` | Company admin / superadmin guards |
| Frosne superadmin-flyter | Firma-livsløp, system/flytdiagnostikk (AGENTS A1.x, P16) |

## Ingen nye parallelle systemer

- Ikke `admin-v2`, ikke duplikat «tower»-API under nytt navn.
- CMS/backoffice forblir **hovedenhet** for innhold (kanonisk beslutning B).

## Deling av kontrollfunksjoner

- **Én** primær flate per domene (f.eks. avtale-godkjenning på superadmin, ikke samme mutasjon på company admin uten produktkrav).
