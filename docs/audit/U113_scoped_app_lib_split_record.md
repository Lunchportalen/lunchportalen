# U113 scoped app/lib split record

Dato: 2026-04-09

Dette er ikke baseline.
Dette er ikke proof.

## U112 MED VIDERE brukt i split

- `app/(backoffice)/**`
- `app/api/**`
- `app/layout.tsx`
- `app/globals.css`
- `app/**`-segmenter med tracked diff (U112-regel)
- `lib/enforce.ts`
- `lib/grouping.ts`
- `lib/<segment>/**` der segmentet har tracked diff mot `HEAD` (U112-regel)

## Eksplisitt ikke med

- `app/saas/**`
- `app/public/**`
- `app/product/**`
- `lib/<segment>/**` med `diff=0` og kun untracked (UTENFOR BASELINE NÅ i U112)
- Alt utenfor `app/**` og `lib/**`

## Faktisk staged/committet produktkode

- Kun `app/**` + `lib/**` innenfor reglene over
- Ingen `components/**`, `tests/**`, `e2e/**`, `docs/**` i produktkode-commit
- Produktkode-commit: `0ab2cf35138e8d4204df32d01543a65567d9438d`
- Commit-melding: `app/lib: commit scoped keep-candidates from U112`

## Hva dette åpner for

- Neste tekniske pakke kan nå håndtere ikke-baseline-treet separat uten å blande inn U112 keep-candidates.
# U113 — Scoped split: `app/**` + `lib/**` keep-candidates (git-sannhet)

**Dato:** 2026-04-09  
**HEAD før pakke:** `72346ecdeb2b26efbfae27caac56928623896f13`  
**Status:** Dette er **ikke** baseline. Dette er **ikke** proof. Kun sporbarhet for hva som ble forsøkt og hvorfor teknisk split stoppet.

---

## A) U112 «MED VIDERE» — bekreftet funn

**Det finnes ingen U112 canonical record i `docs/audit/**`** (ingen `U112*.md`, ingen annen fil som låser eierbeslutning).

**Eneste referanse til U112** er i `docs/audit/U111_owner_scope_WIP_untracked_gate.md` §9: U112 er **anbefalt neste pakke** («Eierbinding: untracked `lib/**`-tre + kobling mot `app/api` og `app/(backoffice)`»), **ikke** en utført post med:

- eksplisitte **MED VIDERE**-blokker (paths/patterns),
- **UTENFOR BASELINE NÅ**,
- **UTSATT**,
- eller hva neste tekniske pakke «får lov til».

**Konklusjon:** U113 kan **ikke** stage eller committe `app/**` / `lib/**` uten å **gjette** eller **improvisere**. Pakken stoppet her (per U113-A: uklar U112 ⇒ stopp).

---

## B) Staging / commit (app + lib)

| Handling | Resultat |
|----------|----------|
| Staging av U112-godkjente `app/**` + `lib/**` | **Ikke utført** — manglende bindende U112-liste |
| Commit av scoped keep-candidates | **Ikke utført** |

**Ingen `git add` av `app/` eller `lib/`** ble kjørt i denne pakken.

---

## C) Målinger ved stopp (for kontekst, ikke scope-bevis)

| Kommando / mål | Resultat |
|----------------|----------|
| `git rev-parse HEAD` (før endring) | `72346ecdeb2b26efbfae27caac56928623896f13` |
| `git diff --name-only -- app lib` (antall linjer) | **652** tracked filer med diff under `app` + `lib` |
| `git ls-files --others --exclude-standard app lib` | **2163** untracked paths under `app` + `lib` |
| `git diff --cached --name-only` | **tom** (ingenting staged) |
| `npm run typecheck` | **PASS** |
| `npm run test:run` | **PASS** (359 testfiler pass / 4 skipped; 1599 tester pass / 13 skipped) |

*Typecheck/test beviser ikke at et vilkårlig delsett av 652+2163 filer er «U112-godkjent».*

---

## D) Hva som eksplisitt **ikke** inngikk

- Hele working tree under **`app/**`** og **`lib/**`** (både tracked diff og untracked) — **ikke** isolert i egen commit.
- **`components/**`, `tests/**`, `e2e/**`, `docs/**` (øvrig), `artifacts/**`, øvrig rot** — **ikke** rørt i denne pakken.

---

## E) Neste pakke (én)

**U112 (bindende eierpost)** — faktisk utført som egen leveranse:

- **Navn:** `U112_owner_binding_MED_VIDERE_app_lib.md` (eller tilsvarende fast navn i `docs/audit/`)
- **Innhold som minimum:** eksplisitte path-mønstre for **MED VIDERE**, **UTENFOR BASELINE NÅ**, **UTSATT**, og **ekstern avklaring** der relevant.
- **Hva den lukker:** Forutsetningen U113 krevde — uten den er **ingen ærlig** scoped git-split av `app`+`lib` mulig.

---

## F) Gjentakelse av U113 (etter U112)

Når U112-record finnes og er entydig: stage **kun** filer som matcher U112 **MED VIDERE**; én commit **kun** for det settet; audit-record **annen** commit enn produktkode (som allerede spesifisert i U113-krav).
