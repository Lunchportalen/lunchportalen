# TOP 10 — minste realistiske patch-plan

**Ikke implementert her** — kun rekkefølge, filer, test og risiko.

---

## 1. Stram `MENU_FILE_HINT_RE` så `select-none` ikke klassifiserer fil som meny

| Felt | Innhold |
|------|---------|
| **Filer** | `scripts/agents-ci.mjs` (linje **32**-området: `MENU_FILE_HINT_RE`) |
| **Rekkefølge** | 1 (først — unblokker overflow-gate uten å endre UI) |
| **Patch** | Erstatt `Select` med `\bSelect\b` **eller** fjern `Select` og bruk mer presise mønstre (f.eks. `@radix-ui/react-select`). Verifiser at ekte Radix Select fortsatt fanges om nødvendig. |
| **Test** | `npm run build:enterprise` (eller `node scripts/agents-ci.mjs` med `RC_MODE=true` som i pipeline) til **agents:check PASS**. Manuell stikkprøve: én fil med `select-none` + `overflow-hidden` skal ikke feile med mindre den er ekte meny. |
| **Risiko** | **Lav** hvis endringen kun strammer regex. **Medium** hvis Radix-import fjernes fra treff — da må `components` med faktisk Select verifiseres. |
| **Gevinst** | **Strukturell** (CI-sannhet); ikke kosmetisk. |

---

## 2. Gjør API contract-gate kompatibel med `jsonOk`-only routes

| Felt | Innhold |
|------|---------|
| **Filer** | `scripts/agents-ci.mjs` (seksjon **v2 gate #2**, ca. linje **189–234**); evt. `app/api/superadmin/control-tower/*/route.ts` hvis dere velger rute-siden i stedet |
| **Rekkefølge** | 2 (etter 1, eller parallelt hvis uavhengig) |
| **Patch** | **Alternativ A:** Utvid betingelse: hvis `\bjsonOk\b` og `\bmakeRid\b` og import fra `@/lib/http/respond`, **skip** tekstkrav (tillit til helper). **Alternativ B:** Legg til eksplisitt `jsonErr`-import og død `unreachable` error-branch med `jsonErr` i hver route. **Alternativ C:** Legg inn kommentar-ankere `// ok: true` / `// ok: false` — **minste diff men teknisk gjeld.** |
| **Test** | `npm run build:enterprise` gjennom `agents:check`; manuelt GET på control-tower API og verifiser JSON-body har `ok`+`rid` (fra `jsonOk` i `lib/http/respond.ts`). |
| **Risiko** | **Medium** — endring av gate påvirker alle 314 routes’ statiske analyse. A er mest sikker om logikken speiler faktisk runtime. |
| **Gevinst** | **Strukturell** (CI matcher faktisk kontrakt). |

---

## 3. Utvid Vitest Supabase-mock med `.limit().maybeSingle()`-kjede for `system_settings`

| Felt | Innhold |
|------|---------|
| **Filer** | `tests/api/order-flow-api.test.ts` (mock `from`, ca. **64–97**); ev. `tests/api/order-api-guards.test.ts` (samme mønster hvis duplisert) |
| **Rekkefølge** | 3 |
| **Patch** | På `chain`, legg til `limit: () => ({ ...chain, maybeSingle: async () => { if (table === "system_settings") return { data: <defaults>, error: null }; ... } })` med realistisk `toggles`/`killswitch` slik at `withDefaults` i `getSystemSettingsSafe` fungerer. **Presis payload** må matche `lib/system/settings.ts` `withDefaults`. |
| **Test** | `npm run test:run -- tests/api/order-flow-api.test.ts tests/api/order-api-guards.test.ts` |
| **Risiko** | **Lav–medium** — feil default kan skjule reelle regressjoner (bruk eksplisitte defaults som speiler prod). |
| **Gevinst** | **Strukturell** (tester validerer ordre-logikk igjen, ikke 503-støy). |

---

## 4. Korriger `postLoginRedirectSafety` superadmin-test mot E5

| Felt | Innhold |
|------|---------|
| **Filer** | `tests/auth/postLoginRedirectSafety.test.ts` (test **70–88**); tittel endres fra «honors safe next=/week» til «superadmin unsafe next=/week falls back to landing» eller lignende |
| **Rekkefølge** | 4 |
| **Patch** | `expect(location.includes("/superadmin")).toBe(true)` (eller `new URL(location).pathname === "/superadmin"`) når `next=/week`. |
| **Test** | `npm run test:run -- tests/auth/postLoginRedirectSafety.test.ts` |
| **Risiko** | **Lav** — kun test; **må** samsvare med `lib/auth/role.ts` **17–35** og `app/api/auth/post-login/route.ts` `resolvePostLoginTarget`. |
| **Gevinst** | **Strukturell** (én sannhet mellom test og kontrakt). |

---

## 5. Fiks `motionSystemProof` form-test til å bruke samme bevisstrategi som andre blokker

| Felt | Innhold |
|------|---------|
| **Filer** | `tests/motion/motionSystemProof.test.ts` (**102–110**) |
| **Rekkefølge** | 5 |
| **Patch** | Bytt til `renderToStaticMarkup(React.createElement(React.Fragment, null, out))` og `expect(html).toContain("lp-motion-card")` som linje **85–93**, **eller** bruk `render` fra `@testing-library/react` og `screen.getBy*` hvis klassen er på barn. |
| **Test** | `npm run test:run -- tests/motion/motionSystemProof.test.ts` |
| **Risiko** | **Lav–medium** — test kan bli grønn uten reell parity hvis `lp-motion-card` finnes et annet sted; hold assertion streng nok. |
| **Gevinst** | **Strukturell** (parity-test er meningsfull igjen). |

---

## 6. Konsolider Sanity Studio til én konfigurasjon (planlagt, ikke stor bang)

| Felt | Innhold |
|------|---------|
| **Filer** | `studio/sanity.config.ts`, `studio/lunchportalen-studio/sanity.config.ts`, `package.json` (scripts som refererer til studio), `sanity.cli` hvis finnes |
| **Rekkefølge** | 6 (etter CI grønn) |
| **Patch** | Velg **én** entry; kopier `projectId`/dataset fra env; **slett** eller arkiver den andre mappen etter deploy-verifisering. |
| **Test** | `npm run sanity:live` mot preview-URL; manuelt `sanity` dev/build. |
| **Risiko** | **Medium** — feil projectId kan skrive til feil dataset. |
| **Gevinst** | **Strukturell** (én sannhet for Studio). |

---

## 7. Dokumenter eller fjern usporet `archive/`

| Felt | Innhold |
|------|---------|
| **Filer** | `archive/**` (lokalt), `.gitignore` (hvis skal ignoreres), eller `git add` + README |
| **Rekkefølge** | 7 (lav risiko, kan gjøres når som helst) |
| **Patch** | Enten **slett** etter diff mot `app/` eller **legg til** `archive/README.md` med «ikke brukt i produkt» + hvorfor. |
| **Test** | Ingen automatisk test; `git status` rent. |
| **Risiko** | **Lav** ved sletting hvis ikke i git. |
| **Gevinst** | **Kosmetisk/prosess** for utviklere, men reduserer feil navigasjon. |

---

## 8. Hard fail eller eksplisitt URL for `sanity:live` i enterprise-pipeline

| Felt | Innhold |
|------|---------|
| **Filer** | `scripts/sanity-live.mjs`; `.github/workflows/ci-enterprise.yml` (set `SANITY_LIVE_URL` eller `NEXT_PUBLIC_SITE_URL`) |
| **Rekkefølge** | 8 |
| **Patch** | I CI: sett `SANITY_LIVE_URL` til preview deployment; **eller** etter `timeout` exit **1** når `CI=true`. |
| **Test** | Workflow dispatch / PR med kjent URL. |
| **Risiko** | **Medium** — flaky nett; trenger retry eller lengre timeout. |
| **Gevinst** | **Strukturell** (operasjonell tillit). |

---

## 9. Erstatt `console.error` i `getSystemSettingsSafe` med strukturert logg

| Felt | Innhold |
|------|---------|
| **Filer** | `lib/system/settings.ts` (**93–106**); ev. `lib/ops/log.ts` |
| **Rekkefølge** | 9 |
| **Patch** | `opsLog` / eksisterende observability med rid (krever at kaller sender rid — **ikke** alltid tilgjengelig her; da scoped log uten PII). |
| **Test** | Enhetstest med mock som triggerer fetch-feil; verifiser ingen rå `console.error` i prod path (eller at logger er konsistent). |
| **Risiko** | **Lav** hvis API til logger er stabilt. |
| **Gevinst** | **Strukturell** (observability), delvis **sikkerhet** (mindre støy). |

---

## 10. Plan for modularisering av `ContentWorkspace.tsx` (første skille, ikke full refaktor)

| Felt | Innhold |
|------|---------|
| **Filer** | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`; eksporter `useContentWorkspace*` hooks som allerede finnes i `useContentWorkspacePageData.ts` m.fl. |
| **Rekkefølge** | 10 (etter gates grønne) |
| **Patch** | **Første** skille: flytt **én** isolert del (f.eks. AI-kall eller lagringscluster) til `contentWorkspace.saveCluster.ts` eller lignende **uten** å endre oppførsel; behold eksportflate. |
| **Test** | `npm run test:run -- tests/cms/contentWorkspaceStability.smoke.test.ts` (hvis finnes), `tests/cms/*` som treffer workspace; manuell smoke i backoffice. |
| **Risiko** | **Høy** — største patch i listen; **minste** realistiske steg er **én** utbrytning. |
| **Gevinst** | **Strukturell** (vedlikehold); ikke kosmetisk. |

---

## Rekkefølge-oppsummering (anbefalt)

1. Regex `agents-ci` (menu hint).  
2. API contract gate eller `jsonOk`-unntak.  
3. Order-test mock.  
4. Post-login test.  
5. Motion test.  
6–8. Sanity / archive / sanity-live (kan parallelliseres).  
9. Logging.  
10. ContentWorkspace utbrytning.
