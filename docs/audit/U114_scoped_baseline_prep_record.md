# U114 — Scoped baseline prep record (git-sannhet)

Dato: 2026-04-09  
HEAD ved måling: `be8235b996d8958a69b90a7d8595201238601c74`

Dette er ikke proof.  
Dette er ikke full repo-baseline.

## Scoped subset vurdert

Kilde: `docs/audit/U113_scoped_app_lib_split_record.md`

- Isolert i U113 produktkode-commit: U112 MED VIDERE under `app/**` + `lib/**`
- Utenfor i U113/U112: `app/saas/**`, `app/public/**`, `app/product/**`, og `lib/<segment>/**` med `diff=0` og kun untracked

## Måling av subset mot virkeligheten

Kjørte kommandoer:

- `git rev-parse HEAD`
- `git status --short`
- `git diff --name-only -- app lib`
- `git diff --stat -- app lib`
- `git diff --cached --name-only -- app lib`
- `git ls-files --others --exclude-standard app lib`
- `npm run typecheck`
- `npm run test:run`

Funn:

- `git diff --name-only -- app lib`: tom (ingen unstaged diff i `app/lib`)
- `git diff --stat -- app lib`: tom (ingen unstaged stat i `app/lib`)
- `git diff --cached --name-only -- app lib`: tom (ingen staged i `app/lib`)
- `git ls-files --others --exclude-standard app lib`: viser untracked i U112-ekskluderte trær (`app/product`, `app/public`, `app/saas`, og mange `lib/*`-segmenter utenfor)
- `npm run typecheck`: PASS
- `npm run test:run`: PASS (359 passed / 4 skipped filer, 1599 passed / 13 skipped tester)

Hva dette beviser / ikke beviser:

- Beviser: isolert subset fra U113 lekker ikke som pågående git-diff i `app/lib` nå.
- Beviser ikke: at hele repoet er baseline-klart.
- Beviser ikke: at utenfor-scope trær er avklart.

## U114-status

SCOPED BASELINE-KANDIDAT KAN NÅ FORBEREDES.

Begrunnelse: Det isolerte U113-subsettet står rent i `app/lib` (ingen unstaged/staged diff), mens gjenstående støy i `app/lib` ligger i U112-ekskluderte trær og påvirker ikke scoped-kandidaten direkte.

## Neste pakke

Navn: `formalize scoped baseline record`

Hvorfor: scoped kandidat er målt som ren nok i git-tilstand og må låses formelt uten å blande inn full-repo.

Hva den lukker: binder scoped baseline-kandidat som eksplisitt, avgrenset baseline-spor (ikke proof, ikke full baseline freeze).
