# 👨‍💻 LUNCHPORTALEN – DEVELOPER ONBOARDING GUIDE

Velkommen til Lunchportalen.

Dette dokumentet er din inngang til systemet.

Lunchportalen er ikke en vanlig webapp.
Det er et deterministisk driftssystem med strenge arkitekturregler.

Les dette før du skriver én linje kode.

---

# 1️⃣ FØR DU STARTER

## 1.1 Installer

- Node >= 20.11
- npm
- Git
- Supabase CLI (valgfritt)
- Vercel CLI (valgfritt)

## 1.2 Installer avhengigheter

```bash
npm install
```

## 1.3 Start dev

```bash
npm run dev
```

RC-mode:

```bash
npm run dev:rc
```

---

# 2️⃣ PROSJEKTETS FILOSOFI

Lunchportalen er bygget på:

- Database-first enforcement
- Fail-closed prinsipp
- Én sannhetskilde
- No-exception rule
- RPC-only writes
- Multi-tenant isolasjon

Du må forstå dette før du endrer noe.

---

# 3️⃣ KRITISKE REGLER

## 3.1 Aldri skriv direkte til orders

Kun via:

- `lp_order_set`
- `lp_order_cancel`

Direkte:

```ts
supabase.from("orders").<write>(...)
```

er forbudt i produksjonskode.

CI stopper deg.

## 3.2 Service-role er farlig

Service-role kan kun brukes i:

- `app/api/cron/**`
- `app/api/superadmin/system/**`

Aldri i order-ruter.

## 3.3 RLS er hellig

RLS håndhever:

- Tenant-isolasjon
- Rollebegrensning
- Write-path kontroll

Ikke deaktiver.
Ikke bypass.
Ikke lag midlertidige unntak.

---

# 4️⃣ PROSJEKTSTRUKTUR (OVERSIKT)

- `/app/` → Next.js App Router
- `/app/api/` → API routes
- `/lib/` → Supabase, auth, guards
- `/supabase/` → SQL migrations
- `/scripts/` → CI og audits
- `/tests/` → Tenant og sikkerhetstester
- Dokumentasjon → `docs/**/*.md`

---

# 5️⃣ KODEENDRINGER

Før du lager feature, les:

- ../security/security-architecture.md
- ../governance/codex-datawrite.md
- architecture-decisions.md

Bestå Avensia-beslutningstesten:

- Bryter dette determinisme?
- Introduserer dette unntak?
- Skaper dette admin-støy?

Hvis svaret er ja → stopp.

---

# 6️⃣ MERGE-KRAV

Før merge:

```bash
npm run preflight
```

Dette kjører:

- ci:guard
- typecheck
- tester
- tenant-isolation test
- lint
- audit

Ingen merge uten grønt.

---

# 7️⃣ FEILSØKING

Hvis noe feiler:

- Ikke patch i produksjon
- Ikke bypass RLS
- Ikke hardkode override
- Sjekk logs
- Sjekk ops_events
- Dokumenter

---

# 8️⃣ TYPISKE FEIL NYE UTVIKLERE GJØR

- ❌ Skriver direkte til DB
- ❌ Lager alternativ write-path
- ❌ Glemmer cut-off enforcement
- ❌ Introduserer feature-flag som omgår gates
- ❌ Endrer rollelogikk i frontend
- ❌ Ignorerer tenant-isolasjon

Dette skal ikke skje.

---

# 9️⃣ HVA DU SKAL FØLE

Du skal:

- Føle at arkitekturen er streng
- Føle at det er vanskelig å gjøre feil
- Føle at systemet beskytter seg selv

Hvis det føles «for fleksibelt», er noe galt.

---

# 🔟 HVORDAN TENKE

Når du lager noe nytt, spør:

- Hvem kan skrive?
- Hvem kan lese?
- Hva skjer hvis noe feiler?
- Hva skjer ved cut-off?
- Hva skjer ved pause/close?
- Hva skjer i multi-tenant?

Systemet skal alltid være forutsigbart.

---

# 1️⃣1️⃣ HVEM SPØR DU?

Ved tvil:

- Spør teknisk ansvarlig
- Les ADR
- Ikke improviser

---

# 🏁 KONKLUSJON

Lunchportalen er ikke bygget for kreativ frihet.
Den er bygget for kontroll.

Din jobb er å forsterke arkitekturen – ikke svekke den.

Velkommen til teamet.

---

# 12 Secrets og lokal miljøhygiene (2026-05-25)

**Formål:** Unngå at live credentials ligger i repo-roten (audit A-P1-01). Dette er **anbefalt mønster** — eier beslutter rotasjon separat ([`../../scripts/security/rotate-checklist-2026-05-25.md`](../../scripts/security/rotate-checklist-2026-05-25.md)).

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

Se [`../audit/enterprise-v2-2026-05-25/01-spike-cleanup.md`](../audit/enterprise-v2-2026-05-25/01-spike-cleanup.md) — bl.a. `.env.*.tmp`, `.env.*-check`, `.env.*-backup`, `.commit_msg_*.txt`, MCP apply JSON.

## 12.6 Rotasjon

Hvis du har hatt env-snapshots i repo-mappen: følg [`../../scripts/security/rotate-checklist-2026-05-25.md`](../../scripts/security/rotate-checklist-2026-05-25.md). Rotasjon kjøres **ikke** automatisk av audit.
