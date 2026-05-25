# Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸â€™Â» LUNCHPORTALEN Ã¢â‚¬â€œ DEVELOPER ONBOARDING GUIDE

Velkommen til Lunchportalen.

Dette dokumentet er din inngang til systemet.

Lunchportalen er ikke en vanlig webapp.
Det er et deterministisk driftssystem med strenge arkitekturregler.

Les dette fÃƒÂ¸r du skriver ÃƒÂ©n linje kode.

---

# 1Ã¯Â¸ÂÃ¢Æ’Â£ FÃƒËœR DU STARTER

## 1.1 Installer

- Node >= 20.11
- npm
- Git
- Supabase CLI (valgfritt)
- Vercel CLI (valgfritt)

## 1.2 Installer avhengigheter

```bash
npm install
1.3 Start dev
npm run dev
RC-mode:

npm run dev:rc
2Ã¯Â¸ÂÃ¢Æ’Â£ PROSJEKTETS FILOSOFI
Lunchportalen er bygget pÃƒÂ¥:

Database-first enforcement

Fail-closed prinsipp

Ãƒâ€°n sannhetskilde

No-exception rule

RPC-only writes

Multi-tenant isolasjon

Du mÃƒÂ¥ forstÃƒÂ¥ dette fÃƒÂ¸r du endrer noe.

3Ã¯Â¸ÂÃ¢Æ’Â£ KRITISKE REGLER
3.1 Aldri skriv direkte til orders
Kun via:

lp_order_set

lp_order_cancel

Direkte:

supabase.from("orders").<write>(...)
er forbudt i produksjonskode.

CI stopper deg.

3.2 Service-role er farlig
Service-role kan kun brukes i:

app/api/cron/**

app/api/superadmin/system/**

Aldri i order-ruter.

3.3 RLS er hellig
RLS hÃƒÂ¥ndhever:

Tenant-isolasjon

Rollebegrensning

Write-path kontroll

Ikke deaktiver.
Ikke bypass.
Ikke lag midlertidige unntak.

4Ã¯Â¸ÂÃ¢Æ’Â£ PROSJEKTSTRUKTUR (OVERSIKT)
/app/ Ã¢â€ â€™ Next.js App Router

/app/api/ Ã¢â€ â€™ API routes

/lib/ Ã¢â€ â€™ Supabase, auth, guards

/supabase/ Ã¢â€ â€™ SQL migrations

/scripts/ Ã¢â€ â€™ CI og audits

/tests/ Ã¢â€ â€™ Tenant og sikkerhetstester

Dokumentasjon Ã¢â€ â€™ *.md

5Ã¯Â¸ÂÃ¢Æ’Â£ KODEENDRINGER
FÃƒÂ¸r du lager feature:
Les:

SECURITY_ARCHITECTURE.md

docs/governance/codex-datawrite.md

ARCHITECTURE_DECISIONS.md

BestÃƒÂ¥ Avensia-beslutningstesten:

Bryter dette determinisme?

Introduserer dette unntak?

Skaper dette admin-stÃƒÂ¸y?

Hvis svaret er ja Ã¢â€ â€™ stopp.

6Ã¯Â¸ÂÃ¢Æ’Â£ MERGE-KRAV
FÃƒÂ¸r merge:

npm run preflight
Dette kjÃƒÂ¸rer:

ci:guard

typecheck

tester

tenant-isolation test

lint

audit

Ingen merge uten grÃƒÂ¸nt.

7Ã¯Â¸ÂÃ¢Æ’Â£ FEILSÃƒËœKING
Hvis noe feiler:

Ikke patch i produksjon

Ikke bypass RLS

Ikke hardkode override

Sjekk logs

Sjekk ops_events

Dokumenter

8Ã¯Â¸ÂÃ¢Æ’Â£ TYPISKE FEIL NYE UTVIKLERE GJÃƒËœR
Ã¢ÂÅ’ Skriver direkte til DB
Ã¢ÂÅ’ Lager alternativ write-path
Ã¢ÂÅ’ Glemmer cut-off enforcement
Ã¢ÂÅ’ Introduserer feature-flag som omgÃƒÂ¥r gates
Ã¢ÂÅ’ Endrer rollelogikk i frontend
Ã¢ÂÅ’ Ignorerer tenant-isolasjon

Dette skal ikke skje.

9Ã¯Â¸ÂÃ¢Æ’Â£ HVA DU SKAL FÃƒËœLE
Du skal:

FÃƒÂ¸le at arkitekturen er streng

FÃƒÂ¸le at det er vanskelig ÃƒÂ¥ gjÃƒÂ¸re feil

FÃƒÂ¸le at systemet beskytter seg selv

Hvis det fÃƒÂ¸les Ã¢â‚¬Å“for fleksibeltÃ¢â‚¬Â, er noe galt.

Ã°Å¸â€Å¸ HVORDAN TENKE
NÃƒÂ¥r du lager noe nytt, spÃƒÂ¸r:

Hvem kan skrive?

Hvem kan lese?

Hva skjer hvis noe feiler?

Hva skjer ved cut-off?

Hva skjer ved pause/close?

Hva skjer i multi-tenant?

Systemet skal alltid vÃƒÂ¦re forutsigbart.

1Ã¯Â¸ÂÃ¢Æ’Â£1Ã¯Â¸ÂÃ¢Æ’Â£ HVEM SPÃƒËœR DU?
Ved tvil:

SpÃƒÂ¸r teknisk ansvarlig

Les ADR

Ikke improviser

Ã°Å¸ÂÂ KONKLUSJON
Lunchportalen er ikke bygget for kreativ frihet.
Den er bygget for kontroll.

Din jobb er ÃƒÂ¥ forsterke arkitekturen Ã¢â‚¬â€œ ikke svekke den.

Velkommen til teamet.

---

# 12 Secrets og lokal miljøhygiene (2026-05-25)

**Formål:** Unngå at live credentials ligger i repo-roten (audit A-P1-01). Dette er **anbefalt mønster** — eier beslutter rotasjon separat ([`scripts/security/rotate-checklist-2026-05-25.md`](scripts/security/rotate-checklist-2026-05-25.md)).

## 12.1 Prinsipp

- **Aldri** committ `.env`-filer med ekte nøkler.
- **Aldri** lagre `.env.local.prod-backup`, `.env.*.tmp`, eller Vercel-pull-checkpoints i repo-mappen.
- Live secrets bor **utenfor** git clone, i en lokal secrets-katalog.

## 12.2 Anbefalt layout

### Windows (PowerShell)

```powershell
# Én gang per maskin
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.lp-secrets"

# Prod-lignende lokalt (eksempel — filnavn efter behov)
# Kopier KUN fra sikker kilde (1Password / Vercel pull til ~/.lp-secrets/)
notepad "$env:USERPROFILE\.lp-secrets\local.env"
notepad "$env:USERPROFILE\.lp-secrets\staging.env"
```

### macOS / Linux

```bash
mkdir -p ~/.lp-secrets
chmod 700 ~/.lp-secrets
# ~/.lp-secrets/local.env
# ~/.lp-secrets/staging.env
```

## 12.3 `.env.local` som peker (minimal)

Next.js leser `.env.local` i prosjektroten. **Anbefaling:** hold den minimal og pek til ekstern fil.

**Alternativ A — symlink (Unix / Windows dev mode med admin eller Developer Mode):**

```bash
# Fra repo-root (eksempel)
ln -sf ~/.lp-secrets/local.env .env.local
```

**Alternativ B — thin wrapper (Windows uten symlink):**

`.env.local` inneholder **kun** ikke-hemmelige overrides; hemmeligheter lastes via script før `npm run dev`:

```powershell
# scripts/dev-with-secrets.ps1 (fremtidig — ikke påkrevd i audit)
Copy-Item "$env:USERPROFILE\.lp-secrets\local.env" ".env.local" -Force
npm run dev
Remove-Item ".env.local" -Force -ErrorAction SilentlyContinue
```

**Alternativ C — env-file merge (nåværende mønster i scripts/smoke):**

Behold `.env.local` gitignored, men generer den **kun** fra `~/.lp-secrets/` ved behov — slett etter sesjon.

## 12.4 Vercel env pull

```bash
vercel env pull "$env:USERPROFILE\.lp-secrets\vercel-preview.env"
# IKKE: vercel env pull .env.vercel.pull.checkpoint
```

## 12.5 Forbudte filer i repo-root

Se [`docs/audit/enterprise-v2-2026-05-25/01-spike-cleanup.md`](docs/audit/enterprise-v2-2026-05-25/01-spike-cleanup.md) — bl.a. `.env.*.tmp`, `.env.*-check`, `.env.*-backup`, `.commit_msg_*.txt`, MCP apply JSON.

## 12.6 Rotasjon

Hvis du har hatt env-snapshots i repo-mappen: følg [`scripts/security/rotate-checklist-2026-05-25.md`](scripts/security/rotate-checklist-2026-05-25.md). Rotasjon kjøres **ikke** automatisk av audit.
