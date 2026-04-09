# CRITICAL_PATH_TRACE

Kritiske stier med **filstier** og kort dataflyt. Alle observasjoner er **kodeforankret**.

---

## 1. Boot / init

| Steg | Fil(er) | Notat |
|------|---------|-------|
| Next.js config | `next.config.ts` | Minimal — hovedsakelig cache-headers for `/og/*` |
| Middleware | `middleware.ts` | Setter `x-pathname`, `x-url`; auth redirect for beskyttede stier |
| Env | `lib/config/env` (implisitt via imports) | **Ikke fullstendig kartlagt i denne auditen** — se `.env`-mønstre i CI |

---

## 2. Navigasjon / routing

| Steg | Fil(er) | Notat |
|------|---------|-------|
| Beskyttede paths | `middleware.ts` — `isProtectedPath` | `/saas`, `/week`, `/superadmin`, `/admin`, `/backoffice`, `/orders`, `/driver`, `/kitchen` |
| API bypass | `isBypassPath` | Alle `/api/*` **unntatt** `post-login`, `logout`, `login` — matcher AGENTS.md |

---

## 3. Post-login (kanonisk resolver)

| Steg | Fil | Detalj |
|------|-----|--------|
| POST | `app/api/auth/post-login/route.ts` | `safeNextPath` blokkerer `/login`, `/onboarding`, etc. |
| Rolle → landing | `resolvePostLoginTarget` → `allowNextForRole`, `landingForRole` | Importert fra `lib/auth/role` |
| Eksperiment-cookie | `readLpExpCookie` | `lp_exp` JSON — vekstspor i auth-kritisk bane |

**Root concern:** Auth-flyten er **korrekt strukturert** i denne filen, men **vekst/eksperiment** er koblet til samme path som identitetslandskap (øker kompleksitet og feilflate).

---

## 4. CMS: laste, redigere, lagre

| Steg | Fil(er) | Notat |
|------|---------|-------|
| Editor UI | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | **~6401 linjer** — dominerende "god component" |
| Data hooks | `useContentWorkspaceData.ts`, `contentWorkspace.*` | Modularisering delvis, men sentrert komponent dominerer |
| Blokkkontrakter | `lib/cms/blocks/blockContracts.ts` | `enforceBlockComponentSafety` muterer `data` in-place for layout |
| API | `app/api/backoffice/content/**` | Mange ruter — se `glob **/route.ts` |

---

## 5. Publisert innhold (public)

| Steg | Fil(er) | Notat |
|------|---------|-------|
| Slug → innhold | `lib/cms/getContentBySlug.ts`, `lib/cms/public/getContentBySlug.ts` | Brukt av public pipeline |
| Parity-test | `tests/cms/publicPreviewParity.test.ts` | `@ts-nocheck` svekker type-sikkerhet i kontrakttest |

---

## 6. Global header / footer (DB)

| Steg | Kilde |
|------|--------|
| Schema | `supabase/migrations/20260421000000_global_content.sql` — `key IN ('header','footer','settings')`, `draft`/`published`, `jsonb` |
| API | `app/api/content/global/header/route.ts` (referert i repo-indeksering) |

---

## 7. Sanity

| Steg | Fil | Notat |
|------|-----|-------|
| Klient | `lib/sanity/client.ts` | `sanity` (CDN read), `sanityWrite` (token), `requireSanityWrite()` |
| Advarsler | `sanityWrite` | Logger `console.warn` hvis token mangler i dev |

---

## 8. System motor / repairs (duplikat-path risiko)

| Path A | `app/api/superadmin/system/repairs/run/route.ts` |
| Path B | `superadmin/system/repairs/run/route.ts` (repo root) |

**Begge** inneholder Next route exports og system motor-kommentarer. **Next.js App Router** resolver HTTP fra `app/` — filen under `superadmin/` ved root er **ikke standard** og utgjør **vedlikeholdsrisiko** (to sannheter).

---

## 9. Cache / revalidation

| Steg | Observasjon |
|------|-------------|
| API routes | Mange eksporterer `dynamic = "force-dynamic"`, `revalidate = 0` (eksempel `app/api/something/route.ts`) — **bevisst ingen CDN-cache** for dynamiske endepunkter |
| `next.config.ts` | Lang cache for `/og/*` statiske genererte bilder |

**Ikke verifisert:** Full kartlegging av alle `fetch`-cache og `revalidateTag`-kall — krever dedikert pass.

---

## 10. Feilhåndtering API

| Komponent | Fil |
|-----------|-----|
| RID + JSON | `lib/http/respond.ts` — `makeRid`, `normalizeError` |

Kontrakt `{ ok, rid, ... }` er **implementert** her; avvik i enkelt-ruter må verifiseres med `audit:api` (kjøres i enterprise CI, **ikke** fullt i denne lokale auditen).

---

## 11. Tester som låser kritisk atferd

| Område | Test |
|--------|------|
| Middleware redirect | `tests/middleware/middlewareRedirectSafety.test.ts` |
| Tenant/RLS | `tests/tenant-isolation*.test.ts`, `tests/rls/*.test.ts` |
| CMS | `tests/cms/*.test.ts` (slug, publish, tree, parity) |
| Rolle-API | `tests/security/roleIsolationEndpoints.test.ts` |

**Styrke:** Bred dekning. **Svakhet:** E2E ikke kjørt i denne auditen; bygg OOM lokalt begrenser deploy-tillit på denne maskinen.
