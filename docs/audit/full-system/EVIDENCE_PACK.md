# Evidence Pack — topp 15 funn

Bevis er hentet fra repoet per 2026-03-26. Linjenummer viser til gjeldende filversjon.

---

### 1. `build:enterprise` stopper i `agents:check` — `overflow-hidden` i «menu-relaterte» filer

| Felt | Bevis |
|------|--------|
| **Filsti** | `scripts/agents-ci.mjs` (gate), `app/superadmin/control-tower/ControlTowerClient.tsx`, `components/superadmin/controlTower/ControlTowerInsightActions.tsx` |
| **Navn** | Gate: «Menu overflow-hidden hard fail»; komponenter: `ControlTowerClient`, `ControlTowerInsightActions` |
| **Linjer** | Gate: ca. **164–186**; `overflow-hidden` i `ControlTowerClient.tsx`: **561, 788, 821, 843, 865** (flere); `ControlTowerInsightActions.tsx` **13–15** (klasser med `overflow-hidden`) |

**Utdrag (gate — når fil klassifiseres som menu-related):**

```32:33:c:\prosjekter\lunchportalen\scripts\agents-ci.mjs
const MENU_FILE_HINT_RE = /(ActionMenu|Dropdown|Menu|Popover|ContextMenu|Select|Radix|Portal)/i;
const MENU_PATH_HINT_RE = /(components\/.*(menu|dropdown|popover)|app\/.*(menu|dropdown|popover))/i;
```

```172:186:c:\prosjekter\lunchportalen\scripts\agents-ci.mjs
  const isMenuRelated =
    MENU_PATH_HINT_RE.test(rel) ||
    MENU_FILE_HINT_RE.test(text) ||
    /ActionMenu/i.test(rel);

  if (!isMenuRelated) continue;

  const re = /\boverflow-hidden\b/g;
  // ...
    reportMatches("HARD FAIL", file, text, re, name, hint, true);
```

**Utdrag (Tailwind `select-none` treffer `Select` i regex):**  
`ControlTowerClient.tsx` linje **557** (representativ): `... select-none items-center ...`

**Symptom:** `npm run build:enterprise` feiler med HARD FAIL på `overflow-hidden` i control-tower-filer.  
**Root cause:** `MENU_FILE_HINT_RE` matcher **substringen `select`** i **`select-none`** (case-insensitive `Select`), så hele filen blir «menu-related». Deretter feiler **enhver** `overflow-hidden` (også progress bar / `AlertEdgeFrame`), ikke bare ekte meny-paneler.  
**Klasse:** **CI/CD-feil** (gate-logikk + falsk positiv klassifisering).  
**Handling:** **Fikses** (stram inn regex, f.eks. `\bSelect\b` eller ekskluder `select-none`), evt. **re-arkitekteres** gate-reglene dokumentert.  
**Gjentakelse:** Alle `.tsx`-filer med `select-none` + `overflow-hidden` risikerer samme falske positiv.

---

### 2. `build:enterprise` — API contract gate avviser `route.ts` som kun bruker `jsonOk`

| Felt | Bevis |
|------|--------|
| **Filsti** | `scripts/agents-ci.mjs`; `app/api/superadmin/control-tower/domination/route.ts` (og `golive`, `monopoly`) |
| **Navn** | Gate «API contract gate»; handler `GET` |
| **Linjer** | `agents-ci.mjs` **189–234**; `domination/route.ts` **14–41** (retur via `jsonOk`) |

**Utdrag (gate-betingelser):**

```198:221:c:\prosjekter\lunchportalen\scripts\agents-ci.mjs
  const text = read(file);

  const hasRidGen =
    /\brid\s*\(/.test(text) ||
    /\bmakeRid\b/.test(text) ||
    /\brequestId\b/.test(text) ||
    /\brid:\s*/.test(text);

  const usesRespondHelpers = /\bjsonOk\b/.test(text) && /\bjsonErr\b/.test(text);
  // ...
  const hasOkRidInJson =
    /ok\s*:\s*true/.test(text) && /rid\s*:/.test(text);

  const hasOkFalse =
    /ok\s*:\s*false/.test(text);

  if (usesRespondHelpers) continue;
```

**Utdrag (route uten literal `ok: true` / `ok: false` i filen):**

```34:41:c:\prosjekter\lunchportalen\app\api\superadmin\control-tower\domination\route.ts
    return jsonOk(
      rid,
      {
        generatedAt: new Date().toISOString(),
        ...snap,
      },
      200,
    );
```

`jsonOk` setter `ok: true` i `lib/http/respond.ts` (**106–110**), men **det står ikke som tekst** i `route.ts`.

**Symptom:** CI melder «API CONTRACT VIOLATION» for control-tower-ruter.  
**Root cause:** Statisk tekstsjekk krever `ok: true`, `rid:` og `ok: false` **i route-filen**, eller **både** `jsonOk` og `jsonErr` i samme fil (`usesRespondHelpers`). Ruter med kun `jsonOk(...)` feiler selv om runtime-JSON er korrekt.  
**Klasse:** **CI/CD-feil** (heuristikk vs. faktisk kontrakt).  
**Handling:** **Fikses** (oppdatere `agents-ci.mjs` til å godta `jsonOk`-only, eller importere/bruke `jsonErr` i feilbaner, eller eksplisitte kontrakts-ankere — avhengig av valgt strategi).  
**Gjentakelse:** Enhver ny route som kun bruker `jsonOk` uten `jsonErr` og uten tekstlige `ok:`-literaler.

---

### 3. `npm run test:run` rød — suite 8 feil (samlet)

| Felt | Bevis |
|------|--------|
| **Filsti** | `COMMANDS_RUN_AND_RESULTS.md` (logg); representative `tests/api/order-flow-api.test.ts`, `tests/auth/postLoginRedirectSafety.test.ts`, `tests/motion/motionSystemProof.test.ts` |
| **Navn** | Vitest-run |
| **Linjer** | Se under for del-funn 4, 7, 8 |

**Symptom:** Exit code **1**; **8** feilede tester (resten passerte).  
**Root cause:** Samlet — **ikke én** linje; kombinasjon av mock-skjørhet, test vs kontrakt, og feil testantagelse for React-noder (se punkter 4, 7, 8).  
**Klasse:** **Testfeil** + underliggende **produkt/CI**-konsekvens (rød pipeline).  
**Handling:** **Fikses** (tester og/eller mocks og/eller gate).  
**Gjentakelse:** Hver gang CI kjører `test:run` til feilene er rettet.

---

### 4. Ordre-API-tester: 503 pga. `getSystemSettingsSafe` + ufullstendig mock-kjede

| Felt | Bevis |
|------|--------|
| **Filsti** | `lib/system/settings.ts`; `tests/api/order-flow-api.test.ts`; `lib/settings/cache.ts` |
| **Navn** | `getSystemSettingsSafe`; mock `from()`-kjede |
| **Linjer** | `settings.ts` **89–107**; mock **64–97** (ingen `.limit`) |

**Utdrag (produksjonskall):**

```89:91:c:\prosjekter\lunchportalen\lib\system\settings.ts
export async function getSystemSettingsSafe(sb: SupabaseClient<Database>): Promise<SystemSettings | null> {
  try {
    const { data, error } = await sb.from("system_settings").select("*").limit(1).maybeSingle();
```

**Utdrag (mock — `select` returnerer `chain`, men `.limit` mangler):**

```64:97:c:\prosjekter\lunchportalen\tests\api\order-flow-api.test.ts
      from: (table: string) => {
        const chain: any = {
          select: (..._cols: string[]) => chain,
          eq: (col: string, val: string) => ({ ...chain, [col]: val }),
          maybeSingle: async () => {
```

**Symptom:** `expected 503 to be 200` (og tilsvarende); stderr: `[SETTINGS_FATAL] TypeError: ... .limit is not a function`.  
**Root cause:** Testens Supabase-mock implementerer ikke `.limit(1)` etter `.select("*")`, så `getSystemSettingsSafe` kaster; returnerer `null`; gate returnerer 503.  
**Klasse:** **Testfeil** (mock incompleteness); eksponerer **produkt**-avhengighet til full query-kjede.  
**Handling:** **Fikses** (utvid mock med `limit: () => chain` → `maybeSingle`), eller **erstatt** med felles test-double for `SupabaseClient`.  
**Gjentakelse:** Andre tester som mocker `from` uten full PostgREST-kjede (`tests/api/order-api-guards.test.ts` m.fl. per logg).

---

### 5. `ContentWorkspace.tsx` monolitt (~9933 linjer)

| Felt | Bevis |
|------|--------|
| **Filsti** | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` |
| **Navn** | default export (stor workspace-komponent) |
| **Linjer** | **9933** linjer (telt med `Get-Content \| Measure-Object -Line` på workspace-fil) |

**Symptom:** Enkeltfil dominerer redaksjonell UI; vanskelig code review og risiko for regresjon.  
**Root cause:** Akkumulert funksjonalitet (state, AI, lagring, paneler) uten hard modulgrense.  
**Klasse:** **Arkitekturfeil** (vedlikeholdbarhet / skalerbarhet).  
**Handling:** **Re-arkitekteres** (split i moduler med eksplisitt state-machine eller feature hooks).  
**Gjentakelse:** Lint-hooks advarsler i samme fil (jf. `npm run lint` — `ContentWorkspace.tsx` **2726**, **2754**, **2779**, **2813**, **4460**, **10046**).

---

### 6. `LoosePublicTable` og `any` i `lib/types/database.ts`

| Felt | Bevis |
|------|--------|
| **Filsti** | `lib/types/database.ts` |
| **Navn** | `LoosePublicTable`, `PUBLIC_TABLE_NAMES` |
| **Linjer** | **15–27** (kommentar + type); **60+** tabellnavn-liste |

**Utdrag:**

```15:27:c:\prosjekter\lunchportalen\lib\types\database.ts
 * Loose tables: permissive until `supabase gen types` (Docker) replaces this file.
 * `ai_action_memory` remains strict snake_case (migration contract).
 */
type LoosePublicTable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Row: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Insert: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Update: Record<string, any>;
  Relationships: [];
};
```

**Symptom:** TypeScript sjekker ikke kolonner på «løse» tabeller.  
**Root cause:** Bevisst midlertidig modell + manglende deterministisk `supabase gen types` i pipeline (kommentar linje **3–4**).  
**Klasse:** **Arkitekturfeil** / **dataintegritet**-risiko (compile-time gap).  
**Handling:** **Fikses** gradvis (codegen) eller **erstattes** med genererte typer per miljø.  
**Gjentakelse:** Alle inserts/updates mot løse tabeller via `createClient<Database>()`.

---

### 7. Superadmin post-login test vs. `allowNextForRole` / `landingForRole`

| Felt | Bevis |
|------|--------|
| **Filsti** | `tests/auth/postLoginRedirectSafety.test.ts`; `lib/auth/role.ts` |
| **Navn** | test «superadmin honors safe next=/week»; `allowNextForRole`, `landingForRole` |
| **Linjer** | Test **70–88**; `role.ts` **17–35** |

**Utdrag (test forventning):**

```70:88:c:\prosjekter\lunchportalen\tests\auth\postLoginRedirectSafety.test.ts
  test("superadmin honors safe next=/week", async () => {
    // ...
    const req = mkReq("https://example.com/api/auth/post-login?next=/week");
    // ...
    expect(location.includes("/week")).toBe(true);
  });
```

**Utdrag (implementasjon):**

```17:35:c:\prosjekter\lunchportalen\lib\auth\role.ts
export function landingForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  // ...
}

export function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;

  if (role === "superadmin") return nextPath.startsWith("/superadmin") ? nextPath : null;
```

For `next=/week` returnerer `allowNextForRole("superadmin", "/week")` **`null`**; landing blir **`/superadmin`**, ikke `/week`.

**Symptom:** Test feiler (`expected false to be true` på `location.includes("/week")`).  
**Root cause:** Test beskriver **ønsket** superadmin-tilgang til employee-rute; **kode** følger **superadmin kun `/superadmin*`** (samsvar med `AGENTS.md` E5 intent).  
**Klasse:** **Testfeil** (feil forventning mot låst kontrakt).  
**Handling:** **Fikses** (endre test til å forvente `/superadmin`) eller **slett** testen hvis den er overflødig; **ikke** «fiks» produkt uten eierskap til E5.  
**Gjentakelse:** Andre auth-tester med `@ts-nocheck` (fil **2**).

---

### 8. Motion parity-test: `form`-blokk forventer `className` på React-element

| Felt | Bevis |
|------|--------|
| **Filsti** | `tests/motion/motionSystemProof.test.ts`; `lib/public/blocks/renderBlock.tsx` |
| **Navn** | test «form block with formId wraps in lp-motion-card»; `renderBlock` |
| **Linjer** | Test **102–110**; `renderBlock` **44–91** |

**Utdrag (test):**

```102:110:c:\prosjekter\lunchportalen\tests\motion\motionSystemProof.test.ts
  test("form block with formId wraps in lp-motion-card", () => {
    const out = renderBlock(
      { id: "f1", type: "form", data: { formId: "contact", title: "Kontakt" } },
      "prod",
      "nb"
    );
    const el = out as ReactElement<{ className?: string }> | null;
    expect(el).not.toBeNull();
    expect(el?.props?.className).toContain("lp-motion-card");
  });
```

**Utdrag (`renderBlock` returnerer alltid wrapper-komponent, ikke rå DOM med `className` på root props på denne måten):**

```82:91:c:\prosjekter\lunchportalen\lib\public\blocks\renderBlock.tsx
  return (
    <EnterpriseLockedBlockBridge
      block={{ ...block, type: registryType, data: safeData }}
      merged={merged}
      designSettings={ds}
      visualCanvasEdit={visualForBridge}
      env={env}
      locale={locale}
    />
  );
```

**Symptom:** `toContain` feiler fordi `className` er `undefined` på castet element.  
**Root cause:** Test antar **enkelt element med `className`**, mens `renderBlock` returnerer **`<EnterpriseLockedBlockBridge>`** — klasse kan ligge dypere eller i barn.  
**Klasse:** **Testfeil** (feil assert-strategi).  
**Handling:** **Fikses** (assert på serialisert HTML som andre tester i samme fil **85–93**, eller query innenfor tree).  
**Gjentakelse:** Andre blokker i samme fil bruker `renderToStaticMarkup` (linje **85–93**) og passer bedre med faktisk output.

---

### 9. To Sanity Studio-konfigurasjoner (forskjellig stil / prosjekt)

| Felt | Bevis |
|------|--------|
| **Filsti** | `studio/sanity.config.ts`; `studio/lunchportalen-studio/sanity.config.ts` |
| **Navn** | `defineConfig` (begge) |
| **Linjer** | Hovedstudio **22–33**; `lunchportalen-studio` **6–17** |

**Utdrag (hardkodet projectId i én):**

```6:11:c:\prosjekter\lunchportalen\studio\lunchportalen-studio\sanity.config.ts
export default defineConfig({
  name: 'default',
  title: 'Lunchportalen Studio',

  projectId: 'f3vuhd2f',
  dataset: 'production',
```

**Utdrag (env-basert projectId i annen):**

```7:19:c:\prosjekter\lunchportalen\studio\sanity.config.ts
const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
// ...
if (!projectId) {
  throw new Error(
```

**Symptom:** To «sannheter» for hvordan Studio kjører.  
**Root cause:** Historikk / duplikat workspace uten sammenslåing.  
**Klasse:** **Arkitekturfeil** (konfigurasjonsdrift).  
**Handling:** **Erstattes** med én studio-pakke eller **slett** den som ikke brukes i deploy (etter verifisering).  
**Gjentakelse:** `package.json` scripts peker til én `sanity`-inngang — **ikke verifert** hvilken som er canonical uten å lese deploy-dokumentasjon.

---

### 10. `archive/` på disk — ikke sporet av git

| Felt | Bevis |
|------|--------|
| **Filsti** | `archive/` (rot); `git ls-files archive/` → tom |
| **Navn** | N/A (mappe) |
| **Linjer** | N/A |

**Symptom:** Utviklere ser dupliserte/forlatt filer (f.eks. `archive/app/today/todayClient.tsx`).  
**Root cause:** Mapper eksisterer lokalt men er **ikke** i versjonskontroll.  
**Klasse:** **Arkitekturfeil** / rot (prosess).  
**Handling:** **Slett** etter bekreftelse eller **spor** med tydelig `README` om status.  
**Gjentakelse:** `dead-files.json` lister mange stier — annet spor av «død kode»-problem (ikke verifert mot git i denne pakken).

---

### 11. `sanity:live` — soft pass når base-URL ikke svarer

| Felt | Bevis |
|------|--------|
| **Filsti** | `scripts/sanity-live.mjs` |
| **Navn** | `fetchJson`, timeout |
| **Linjer** | **11–19** (base URL); **45–78** (fetch) |

**Utdrag:**

```11:19:c:\prosjekter\lunchportalen\scripts\sanity-live.mjs
const envBase =
  process.env.SANITY_LIVE_URL || // ✅ explicit for this script
  process.env.PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.VERCEL_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "http://localhost:3000";
```

**Symptom:** Logg: «WARNING: unreachable URL, skipping (soft gate)» når localhost ikke kjører.  
**Root cause:** Script er **designet** for å ikke hard-faile når app ikke kjører.  
**Klasse:** **Observability-feil** / **CI/CD**-svakhet (grønn exit uten faktisk sjekk).  
**Handling:** **Erstattes** i CI med kjøring mot deployet preview-URL, eller **fikses** med eksplisitt `SANITY_LIVE_URL` og hard fail i enterprise-pipeline.  
**Gjentakelse:** Alle «soft gate»-scripts som `exit 0` uten bevis.

---

### 12. `console.error` i settings-path (støy / potensielt sensitivt)

| Felt | Bevis |
|------|--------|
| **Filsti** | `lib/system/settings.ts` |
| **Navn** | `getSystemSettingsSafe` |
| **Linjer** | **93–106** |

**Utdrag:**

```93:106:c:\prosjekter\lunchportalen\lib\system\settings.ts
    if (error) {
      console.error("[SETTINGS_FETCH_ERROR]", error);
      return null;
    }

    if (!data) {
      console.error("[SETTINGS_EMPTY]");
      return null;
    }
  } catch (err) {
    console.error("[SETTINGS_FATAL]", err);
    return null;
  }
```

**Symptom:** `[SETTINGS_FATAL]` i test stderr.  
**Root cause:** Direkte `console.error` i stedet for strukturert logger med rid/kontekst (sammenlign `lib/ops/log` brukt andre steder).  
**Klasse:** **Observability-feil** (konsistens).  
**Handling:** **Fikses** (koble til `opsLog` / strukturert logg med policy).  
**Gjentakelse:** `grep` viser mange `console.*` i `lib/` — **ikke alle listet** her.

---

### 13. `as unknown as` — eksempel på svekket typesikkerhet

| Felt | Bevis |
|------|--------|
| **Filsti** | `src/lib/guards/assertCompanyActiveApi.ts` (representativ) |
| **Navn** | `assertCompanyActiveOr403` |
| **Linjer** | **8–10** |

**Utdrag:**

```7:11:c:\prosjekter\lunchportalen\src\lib\guards\assertCompanyActiveApi.ts
type Args = {
  supa: any;
  companyId: string;
  rid: string;
};
```

**Symptom:** `any` for Supabase-klient unngår typefeil.  
**Root cause:** Pragmatisk API-wrapper uten `SupabaseClient<Database>`.  
**Klasse:** **Arkitekturfeil** (type-gjeld).  
**Handling:** **Fikses** (streng `SupabaseClient<Database>`).  
**Gjentakelse:** `grep` «as unknown as» treffer **34** filer (workspace-telling) — ikke alle listet.

---

### 14. Parallell `src/lib` og `lib/`

| Felt | Bevis |
|------|--------|
| **Filsti** | `src/lib/guards/assertCompanyActiveApi.ts` vs `lib/guards/assertCompanyActive.ts` (importert) |
| **Navn** | `assertCompanyActiveOr403` |
| **Linjer** | `assertCompanyActiveApi.ts` **4–5** (import fra `@/lib/...`) |

**Utdrag:**

```4:5:c:\prosjekter\lunchportalen\src\lib\guards\assertCompanyActiveApi.ts
import { assertCompanyActive } from "@/lib/guards/assertCompanyActive";
import { jsonErr } from "@/lib/http/respond";
```

**Symptom:** To «lib»-rotfølelser (`src/lib` vs `lib`).  
**Root cause:** Delvis migrering eller isolert guard lagt i `src/`.  
**Klasse:** **Arkitekturfeil** (navigasjon / eierskap).  
**Handling:** **Re-arkitekteres** (flytt til `lib/` eller dokumenter eksplisitt formål med `src/`).  
**Gjentakelse:** `git ls-files "src/**"` = **4** filer — begrenset omfang men forvirrende.

---

### 15. Stor APIflate — 314 `route.ts`

| Felt | Bevis |
|------|--------|
| **Filsti** | `app/api/**/route.ts` |
| **Navn** | Next.js Route Handlers |
| **Linjer** | N/A (antall) |

**Kommando:** `git ls-files "app/api/**/route.ts"` → **314** filer (kjørt i audit).

**Symptom:** Hver rute kan avvike i auth/validering.  
**Root cause:** Flat HTTP-modell uten genererte kontraktsgrenser per rute.  
**Klasse:** **Sikkerhetsfeil** (flate risiko) + **arkitekturfeil** (skalerbarhet av review).  
**Handling:** **Re-arkitekteres** (grupperte moduler, felles fabrikk for JSON-svar, stikkprøve-audit + automatikk). `scripts/audit-api-routes.mjs` dekker **prefiks**, ikke alt — se **linje 12–55** for `AUDITED_PREFIXES` / `EXCLUDED_PREFIXES`.

**Gjentakelse:** Nye ruter under `app/api/superadmin/control-tower/` uten gate-støtte (punkter 1–2).

---

## Navigasjonsindeks

| # | Kort tittel | Primær fil |
|---|-------------|------------|
| 1 | overflow gate / `select-none` | `scripts/agents-ci.mjs` |
| 2 | API contract tekstgate | `scripts/agents-ci.mjs` |
| 3 | Rød test-suite | Vitest (samlet) |
| 4 | Settings mock | `lib/system/settings.ts` + `tests/api/order-flow-api.test.ts` |
| 5 | ContentWorkspace monolitt | `ContentWorkspace.tsx` |
| 6 | Loose DB types | `lib/types/database.ts` |
| 7 | Superadmin test | `tests/auth/postLoginRedirectSafety.test.ts` |
| 8 | Motion test | `tests/motion/motionSystemProof.test.ts` |
| 9 | Dobbelt Sanity | `studio/*/sanity.config.ts` |
| 10 | Usporet archive | `archive/` |
| 11 | sanity:live soft | `scripts/sanity-live.mjs` |
| 12 | console.error settings | `lib/system/settings.ts` |
| 13 | `any` i guard | `src/lib/guards/assertCompanyActiveApi.ts` |
| 14 | `src/lib` vs `lib` | `src/lib/guards/*` |
| 15 | 314 API routes | `app/api/**/route.ts` (antall) |
