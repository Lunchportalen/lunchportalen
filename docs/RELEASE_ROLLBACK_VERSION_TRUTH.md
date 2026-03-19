# Release, rollback og versjon – sannhetskilde

Dette dokumentet avgrenser **hva som finnes** vs **hva som ikke finnes** i Lunchportalen når det gjelder release, rollback og innholdsversjonering.

## 1. App/deploy-nivå (kode)

**Eksisterer og er autoritativt:**

- **docs/FULL_PACKAGE.md** – RC runbook:
  - **Rollback:** Kun tillatt ved **`git revert <sha>` og redeploy**.
  - Ingen manuelle hotfixes eller improvisasjon i prod.
- Release er **tag + deploy** (f.eks. Vercel). Det finnes ingen egen «release pipeline»-kode i repo utover skript og dokumentasjon.

**Konklusjon:**  
På app-nivå finnes **ingen** programmatisk rollback. Rollback = versjonskontroll (revert) + ny deploy. Det er **100 % klart** og dokumentert.

---

## 2. Innhold (CMS / sider)

**Eksisterer ikke:**

- **Ingen** tabell eller API for **per-side innholdsversjonering** (revisjoner av en enkelt side, «rollback til revisjon X» for en side). Ingen `page_versions` eller tilsvarende i søk.
- FULL_PACKAGE.md omtaler **ikke** innholdsversjonering; den omtaler kun kode-release og rollback.

**Eksisterer (verifisert i kode):**

- **Backoffice releases:** `app/api/backoffice/releases/route.ts` – GET lister releases, POST oppretter release med `name`, `environment` (prod/staging), `publish_at`. Dette er **release/deploy-nivå** (f.eks. «Release 2026-03-10»), ikke per-side versjonering. Rollback av en slik release er **ikke** implementert i API-et; rollback for kode er fortsatt git revert + redeploy.

**Eksisterer (annen kontekst):**

- **Menyer / uke:** `MenusClient.tsx` og `/api/superadmin/menu-publish` – «publish» for en gitt dato (publish/unpublish). Dette er **ikke** samme som CMS-side-versjonering.
- **Side-status:** Backoffice/content kan ha begreper som «kladd» vs «publisert» (f.eks. `PageStatus`) i typene – men det ble **ikke** funnet noen rute eller tabell for «rollback til forrige versjon av denne siden» eller «list alle revisjoner».

**Konklusjon:**  
**Det finnes ingen ekte release/rollback eller versjonering på innholdsnivå** i den delen av systemet som ble undersøkt. «Rollback» av innhold er **ikke** implementert som «velg tidligere revisjon og gjenopprett». Hvis UI eller dokumentasjon gir inntrykk av at brukeren kan rulle tilbake en side til en tidligere versjon, er det feil inntil det finnes en klar implementasjon og kontrakt.

---

## 3. Anbefaling

- **Kode:** Fortsett å bruke FULL_PACKAGE.md – rollback = git revert + redeploy.
- **Innhold:** Enten:
  - **Dokumenter brutalt tydelig** at det ikke finnes innholdsversjonering/rollback (kun lagre overskriver), **eller**
  - Bygg en eksplisitt modell (tabell, API, UI) for revisjoner og «gjenopprett til revisjon X» og oppdater denne doc.

**Ikke** kall «sett til kladd» eller «avpubliser» for rollback – det er statusendring, ikke versjonsrollback. «Rollback» betyr i dette systemet **kun** git revert + redeploy på app-nivå; på innholdsnivå finnes ingen rollback-til-tidligere-revisjon.
