# Rebaseline — remedieringsplan (kun det som fortsatt trengs)

**Forutsetning:** Ingen endring i **frosne** flyter uten eksplisitt instruks (AGENTS.md). Planen er **prioritert** og **kort**.

---

## 0–2 uker

1. **Rydd arbeidskopi / branch-sannhet** — `git status`; sikre at `app/api` og `lib/ai` på disk **matcher** det som skal merges. *Hvorfor:* CI og audit må måle samme kodebase som produksjon.
2. **Dokumenter heap for build** — `NODE_OPTIONS=--max-old-space-size=8192` i CI/README for `build:enterprise`; *valgfritt:* test default heap på CI-runner for å bekrefte eller avkrefte R1.
3. **Sikkerhetsreview `global_content` RLS** — bekreft at **ingen** browser-klient med `authenticated` kan skade data; stram policy eller fjern direkte skriving hvis eksponert.
4. **Reduser `@ts-nocheck` i tester** — start med CMS-kritiske (`tests/cms/**`), én PR om gangen.

---

## 2–6 uker

1. **Fortsett oppdeling av `ContentWorkspace.tsx`** — flytt gjenværende `useMemo`-tunge deler (`blocksForLivePreview`, `visualInlineEditApi` der dokumentert) til dedikerte hooks/moduler; **behold** én primær state-sannhet.
2. **ESLint-strategi** — enten: fiks `exhaustive-deps` i editor-komponenter med **målrettede** refaktorer; eller: dokumenter bevisste unntak med **minimal** `eslint-disable-next-line` + kommentar (ikke masse uforklart).
3. **`<img>` → `next/image` eller bevisst unntak** i CMS der LCP/CLS teller.
4. **Kjør Playwright** på minst **én** kritisk editor-smoke i CI (eller manuelt dokumentert før release).

---

## 6–12 uker

1. **API-konsolidering** — grupper relaterte ruter (feature folders, delte helpers allerede delvis på plass); **ikke** big-bang — reduser duplikat-mønstre og overflate.
2. **Skjemalag for JSONB** — Zod (eller tilsvarende) ved **write**-grenser for CMS-body og global content — bygg ut fra `systemSettingsSchema`-mønster.
3. **Migrer fra `next lint`** til ESLint CLI når team er klart (Next 16-forberedelse).
4. **Modulær `lib/ai`-governance** — eksplisitt «public API»-surface for `lib/ai` (barrel eller package boundary) slik at ikke alt er like «tilgjengelig» fra CMS.

---

**Utelatt med vilje:** Store strategibøker, full Umbraco-erstatning, eller refaktor av frosne superadmin-flyter — uten eierinstruks.
