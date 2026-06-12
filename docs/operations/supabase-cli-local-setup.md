# Supabase CLI — lokal setup og env-hygiene

**Status:** Operasjonsnotat (HOTFIX-C supplement, 2026-05-29)  
**Scope:** Lokal utvikling og pre-flight før `supabase link` / `db push` — **ikke** GitHub Actions secrets.

---

## Regler (LOCKED for dette repo)

### Aldri persistent `SUPABASE_DB_PASSWORD`

**Ikke sett** `SUPABASE_DB_PASSWORD` (eller `SUPABASE_*_DB_PASSWORD`) som **User-scope** eller **Machine-scope** miljøvariabel i Windows/macOS/Linux shell-profil.

Supabase CLI leser disse og **overstyrer** `--password`-flagg og interaktiv input uten tydelig feilmelding. Dette maskerte 6+ timer diagnostikk i HOTFIX-C (2026-05-29): lokal `db push` feilet med 28P01 mens GitHub secret kunne være korrekt.

**Verifiser ren shell før lokal CLI:**

```powershell
# PowerShell — skal være tomme
Get-ChildItem Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
Get-ChildItem Env:SUPABASE_*_DB_PASSWORD -ErrorAction SilentlyContinue
```

```bash
# bash/zsh — skal ikke printe noe
env | grep -i SUPABASE.*DB_PASSWORD
```

Hvis satt: `Remove-Item Env:SUPABASE_DB_PASSWORD` (session) og fjern fra profil (`$PROFILE`, `.bashrc`, etc.).

### `.env.local` — ikke CLI database-passord

`.env.local` skal **ikke** inneholde `SUPABASE_DB_PASSWORD`, `SUPABASE_STAGING_DB_PASSWORD`, eller `SUPABASE_PROD_DB_PASSWORD` for Supabase CLI-formål.

Next.js trenger app-spesifikke navn (f.eks. `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`) — ikke generiske CLI-overstyringsnavn som Supabase CLI også leser.

Roter eller fjern stale linjer etter passord-endring i Dashboard.

### Clean shell som forutsetning for lokal pre-flight

Før du konkluderer at et GitHub secret er feil basert på lokal `supabase link` / `db push`:

1. Ny terminal (ikke gjenbruk session med eksperimentelle exports)
2. Verifiser tom `SUPABASE_*_DB_PASSWORD` env (over)
3. Passord kun via `--password "..."` eksplisitt eller Dashboard-kopiert verdi i **samme** kommando uten clipboard-gjenbruk

Lokal pre-flight er bare valid hvis lokal env er **kjent ren**. Samme fail-silent-klasse som `supabase-migrate.yml` incident 2026-05-29 (pipefail / false green).

### Credentials — ikke clipboard fra chat

Ved kritiske passord (DB, PAT, service role):

- **Ikke** lim inn fra chat til terminal uten å verifisere at clipboard ikke ble overskrevet av forrige paste
- PowerShell: `Read-Host -AsSecureString` eller skriv passord til midlertidig fil med restriktive rettigheter
- GitHub secret: lim direkte fra Dashboard → GitHub UI, ikke via mellomlagring i editor/chat

---

## Staging persistent preview branch

**Project ref:** `uigxsboqeruxflgzqztl`

Dashboard «Reset database password» på persistent preview branch — **udokumentert** om rotering alltid committer server-side. Verifiser kontrollert etter HOTFIX-C er merget (CI post-apply verify + MCP `schema_migrations`).

---

## Management API — database password

`PATCH /v1/projects/{ref}/database` returnerte **404** (2026-05-29). Korrekt endpoint for programmatic reset er **ikke avklart**. Dokumenter her når Supabase support eller docs bekrefter path.

---

## MCP — ikke bruk `ALTER USER postgres`

På managed Supabase Cloud:

```sql
ALTER USER postgres WITH PASSWORD '...';
```

→ `42501: permission denied to alter role` (Only superusers can alter privileged roles).

Bruk Dashboard password reset + GitHub secret, ikke MCP `execute_sql` for passord-rotering.

---

## Referanser

- HOTFIX-C workflow-fix: `.github/workflows/supabase-migrate.yml` (PR #62)
- Incident: `docs/incidents/2026-05-29-msd-provider-id.md`
- Staff audit backlog: `docs/staff-readiness/audit-2026-05-28-full-sweep.md` § Cross-cutting
