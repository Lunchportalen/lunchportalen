# U112 — Bindende eier-scope: `app/**` + `lib/**` (git-derivert)

**Dato:** 2026-04-09  
**Basis:** `docs/audit/U111_owner_scope_WIP_untracked_gate.md` (største blokkering = blandet `lib/` + `app/`, stormsentre `app/api`, `app/(backoffice)`, parallelle `lib/*`-navnerom).  
**HEAD ved måling:** `95e14c9b4b03546e4ed7ac9befc7a126913bd430`  
**Status:** **Ikke** baseline. **Ikke** proof. **Ingen** teknisk split i denne pakken.

---

## A) U111 — største blokkering (kun `app` + `lib`)

Fra U111:

- Untracked topp: **`lib` 1582**, **`app` 581**.
- Diff topp: **`lib` 383**, **`app` 269**.
- Stormsentre (U111 §4): **untracked `app/api` (~260) + `app/(backoffice)` (~256)**; **untracked `lib/*` med mange parallelle rotmapper** (`ai`, `cms`, `social`, `sales`, …); tracked diff i **samme** sentre.

**Måling denne kjøringen (bekreftelse, ikke ny full audit):**

| Mål | Verdi |
|-----|--------|
| `git diff --name-only -- app lib` | **652** paths |
| `git ls-files --others --exclude-standard app lib` | **2163** paths |
| `find app -maxdepth 4 -type f` | **603** |
| `find lib -maxdepth 4 -type f` | **2126** |
| `npm run typecheck` | **PASS** |
| `npm run test:run` | **PASS** (359 filer / 1599 tester grønne; 4 filer / 13 tester skipped) |

*Typecheck/test sier ingenting om hvilke `??`-filer som er baseline-sannhet.*

---

## B–C) Beslutningsblokker og bindende utfall

**Regel (bindende):** Beslutning følger **git-tilstand per toppsegment** (eller rotfil), ikke produktgjetting. **UTENFOR BASELINE NÅ** = ikke del av baseline-arbeidsstrømmen *inntil* mappen får tracked endring eller eier publiserer addendum — **ikke** synonymt med forkastet. **UTSATT** brukes ikke som skjul for «nei»; ingen blokker er her satt til UTSATT.

### `app/**`

| Blokk | Hva det er (U111 + måling) | Utfall |
|-------|----------------------------|--------|
| **`app/(backoffice)/**`** | Stormsentrum; 256 untracked / 83 diff (toppsegment-telling). | **MED VIDERE** |
| **`app/api/**`** | Stormsentrum; 260 untracked / 119 diff. | **MED VIDERE** |
| **`app/layout.tsx`, `app/globals.css`** | Rotfiler med tracked diff. | **MED VIDERE** |
| **`app/saas/**`** | Kun untracked (6), diff 0. | **UTENFOR BASELINE NÅ** |
| **`app/public/**`** | Flat `public` (ikke route-gruppen `(public)`); kun untracked (5), diff 0. | **UTENFOR BASELINE NÅ** |
| **`app/product/**`** | Kun untracked (1), diff 0. | **UTENFOR BASELINE NÅ** |
| **`app/**` øvrige toppsegmenter** (f.eks. `(app)`, `(auth)`, `(public)`, `admin`, `superadmin`, `kitchen`, `driver`, `onboarding`, `today`, …) der `git diff -- app/<segment>` ≠ ∅ **eller** blandet untracked+diff | RC-relaterbar flate med aktiv tracked WIP eller blandet masse. | **MED VIDERE** |
| **Toppsegmenter under `app/` med untracked=0 og diff=0** | Ingen WIP — blokkering ikke materiell. | *(utenfor U112 handlingsflate — N/A)* |

### `lib/**`

| Blokk | Hva det er (U111 + måling) | Utfall |
|-------|----------------------------|--------|
| **`lib/enforce.ts`, `lib/grouping.ts`** | Rotfiler med tracked diff. | **MED VIDERE** |
| **`lib/<toppsegment>/**` der `git diff --name-only -- lib/<toppsegment>` har ≥1 path** | Aktiv endring på eksisterende spor (inkl. `lib/ai` med 273 diff + 421 untracked; `lib/cms`; `lib/auth`; `lib/http`; …). | **MED VIDERE** (hele underliggende tre for det segmentet i neste tekniske pakke) |
| **`lib/<toppsegment>/**` der diff-linjer = 0 og untracked ≥ 1** | Kun nye filer uten tracked endring i mappen — U111 sin «parallel linje»-signatur i ren form. Eksempler på volum (toppnivå): `lib/social` (74), `lib/sales` (60), `lib/growth` (57), `lib/revenue` (45), `lib/autonomy` (38), `lib/ads` (33), `lib/ml` (30), `lib/core` (22), … (full liste = alle mapper som oppfyller diff=0 ∧ untracked>0 i målingen 2026-04-09). | **UTENFOR BASELINE NÅ** |
| **`lib/<toppsegment>/` med untracked=0 og diff=0** | Ingen WIP. | *(N/A)* |

### Egen klassifisering

| Utfall | Brukt i denne runden |
|--------|----------------------|
| **UTSATT TIL SENERE SCOPE** | **Nei** — ingen blokk avsluttet som utsatt. |
| **KAN IKKE AVGJØRES UTEN EKSTERN AVKLARING** | **Nei** — ingen blokk henvist til ekstern gate i denne runden. |

---

## D) Konsekvens og mandat for neste tekniske pakke

**Neste pakke (én):** **U113 — Teknisk git-split:** stage/commit **kun** filer under `app/**` og `lib/**` som faller inn under **MED VIDERE** over (inkl. hele undertrær for `lib/`-segmenter med diff>0, og hele `app/(backoffice)/**`, `app/api/**`, øvrige `app`-segmenter med diff≠∅, samt `app/layout.tsx` og `app/globals.css`).

| Blokk-utfall | Konsekvens | Neste pakke **får lov til** | Neste pakke **får IKKE lov til** |
|--------------|------------|-------------------------------|----------------------------------|
| **MED VIDERE** | Hører til scoped teknisk spor. | `git add` av konkrete paths som matcher MED VIDERE-reglene; én eller flere commits **kun** for dette settet (audit i **annen** commit enn produktkode). | Stage «nærliggende» `??` under `lib/*` som er **UTENFOR BASELINE NÅ** etter diff=0-regelen. |
| **UTENFOR BASELINE NÅ** | Ikke del av baseline-arbeid nå. | Ignorere disse pathene i U113; evt. senere egen pakke eller addendum til U112. | Stage/commit som del av «keep-candidate»-split uten ny bindende post. |

---

## E) Sluttdom (repo-tekst)

**Per nå er `app/**` + `lib/**`-scope låst slik at MED VIDERE følger tracked WIP og U111-stormsentre, mens rent untracked `lib/*` og utvalgte rent untracked `app/*` er UTENFOR BASELINE NÅ; neste ærlige steg er U113 teknisk split etter disse reglene.**
