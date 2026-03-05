# Backoffice scope lock (Beyond Umbraco)

Dette dokumentet definerer **scope** for backoffice-arbeid. Scope lock brukes uten å rely på `.cursorignore` — ved å bruke **whitelist per patch** og scriptet `scripts/backoffice/guard.ps1`.

---

## Patch-policy: whitelist per patch

- Hver patch har en **eksplisitt whitelist** av path-prefixer som er tillatt å endre.
- Filer utenfor whitelist skal **ikke** endres i den patchen.
- Kjør `scripts/backoffice/guard.ps1` med patch-spesifikk whitelist før commit/PR for å oppdage scope drift.

Eksempel (Patch 1) — fra PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backoffice/guard.ps1 -Whitelist "docs/backoffice/","scripts/backoffice/"
```

Fra CMD (én streng, komma-separert):

```cmd
powershell -ExecutionPolicy Bypass -File scripts/backoffice/guard.ps1 -Whitelist "docs/backoffice/,scripts/backoffice/"
```

---

## Never touch (aldri endre som del av backoffice-patcher)

Følgende skal **aldri** røres av backoffice-scope arbeid med mindre eksplisitt godkjent:

- `package.json`, `package-lock.json` (og andre package-manager-filer i rot)
- `app/globals.css`
- `app/layout.tsx` (root layout)
- `supabase/**` (migrations, RLS, config)
- Auth-flows: `middleware.ts`, `/api/auth/**`, `/login`, post-login resolver
- `lib/phone/no.ts` og andre shared/locked utilities utenfor backoffice
- Frozen flows (se AGENTS.md A1.x)

---

## Allowed paths (tillatte områder for backoffice)

Backoffice-arbeid er **kun** tillatt innenfor disse prefiksene (når ikke en patch har en enda strengere whitelist):

- `app/(backoffice)/**`
- `app/api/backoffice/**`
- `lib/backoffice/**`
- `lib/backofficeStore/**` (hvis brukt)
- `docs/backoffice/**`
- `scripts/backoffice/**`

Ingen andre app-, api-, lib- eller root-filer skal endres som del av backoffice-feature/patches uten eksplisitt scope-utvidelse.

---

## STOPP-tekst (bruk når agent går utenfor scope)

Kopier og bruk følgende når en agent forsøker å endre noe utenfor backoffice-scope:

```
STOPP — Scope lock.

Du forsøker å endre fil(er) eller områder som er utenfor tillatt backoffice-scope.
Tillatte områder: app/(backoffice)/**, app/api/backoffice/**, lib/backoffice/**, docs/backoffice/**, scripts/backoffice/**.

Never touch: package.json, package-lock.json, app/globals.css, app/layout.tsx, supabase/**, auth/middleware, frozen flows.

Kjør scripts/backoffice/guard.ps1 med patch-whitelist for å verifisere. Tilbakestill eller begrens endringene til whitelist.
```

---

## Verifisering

- **Pre-commit / pre-PR**: Kjør `guard.ps1` med gjeldende patch-whitelist. Exit code 1 = BLOCKED FILES; ikke merge.
- **Recovery**: Se `docs/backoffice/RECOVERY_PLAYBOOK.md`.
