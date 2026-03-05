# Backoffice recovery playbook (Beyond Umbraco)

Konkrete kommandoer for å sikre og gjenopprette backoffice-arbeid uten scope-glidning.

---

## Pre-patch snapshot

Før du starter en patch (spesielt som endrer kode):

```powershell
# Status og branch
git status
git branch

# Lag ny branch for patchen (anbefalt)
git checkout -b backoffice/patch-N-beskrivelse

# Ev. stash ucommitted endringer (inkl. untracked med -u)
git stash push -u -m "pre-patch-N snapshot"
```

---

## Abort patch

Kast alle lokale endringer og gå tilbake til siste commit:

```powershell
# Forkast alle endringer i tracked filer
git reset --hard HEAD

# Fjern untracked filer og mapper
git clean -fd
```

**Advarsel**: `git clean -fd` sletter untracked filer permanent. Bruk `git clean -fd -n` først for dry-run.

---

## Recover from stash

Hvis du har stashet og vil gjenopprette uten å apply over current branch:

```powershell
# List stash
git stash list

# Opprett ny branch fra stash (bevarer stash)
git stash branch gjenopprettet-patch-N stash@{0}

# Eller apply stash på nåværende branch (stash beholdes)
git stash apply stash@{0}
```

---

## Detect scope drift

Kjør guard-scriptet med patch-whitelist. Hvis noen endrede filer er utenfor whitelist, feiler scriptet (exit 1) og skriver ut BLOCKED FILES.

```powershell
# Eksempel: kun docs og scripts tillatt (f.eks. Patch 1)
powershell -ExecutionPolicy Bypass -File scripts/backoffice/guard.ps1 -Whitelist @("docs/backoffice/","scripts/backoffice/")

# Eksempel: tillat også backoffice app + api
powershell -ExecutionPolicy Bypass -File scripts/backoffice/guard.ps1 -Whitelist @("docs/backoffice/","scripts/backoffice/","app/(backoffice)/","app/api/backoffice/","lib/backoffice/")
```

Bruk output og BLOCKED FILES-listen til å enten reverte de filene eller utvide whitelist (kun etter eksplisitt vurdering).

---

## Windows permission issue for .cursorignore — workaround

Hvis du ikke kan opprette eller redigere `.cursorignore` (f.eks. rettigheter eller policy):

1. **Bruk Git guard i stedet**: Kjør `scripts/backoffice/guard.ps1` før commit/PR. Det krever ikke `.cursorignore`.
2. **Manuell fil-opprettelse**: Opprett `.cursorignore` manuelt med riktig innhold (én linje per path/glob som skal ignoreres) og commit. Hvis filen låses av annen prosess, restart editor eller bruk admin-elevated editor.
3. **Alternativ**: Definér scope kun i `docs/backoffice/SCOPE_LOCK.md` og la agent/utvikler kjøre `guard.ps1` manuelt; ikke rely på at Cursor respekterer `.cursorignore` under alle scenarioer.

---

## Regenerere inventory og gap report

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backoffice/inventory.ps1
```

Dette oppdaterer `docs/backoffice/INVENTORY.md` og `docs/backoffice/GAP_REPORT.md` uten å endre app-kode.
