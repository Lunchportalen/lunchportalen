# PHASE 14C.2 — Vercel incident and target matrix

**Issued:** 2026-07-15  
**Scope:** Read-only containment audit after accidental `vercel promote` during Phase 14C.1

---

## Incident summary

| Field | Value |
|-------|-------|
| Command | `vercel promote dpl_9jVsHqiydHMJgLZsXECtDL6xBgrs` (RC GitHub preview) |
| Intended target | Staging alias |
| Actual target | **Production** deployment queue (`dpl_GUb1jr4dJbNkaCoofh9DfmVHvCDD`) |
| Remediation | `vercel remove dpl_GUb1jr4dJbNkaCoofh9DfmVHvCDD --yes` before completion |
| Production changed | **NO** (verified below) |
| Preventive control | **Never use `vercel promote`** for staging; use `--target=staging` deploy + explicit alias only after read-only matrix |

---

## Target matrix

| Project | Environment | Domain | Current deployment | Git SHA (health) | Supabase | Sanity | Writable in 14C.2 |
|---------|-------------|--------|-------------------|------------------|----------|--------|-------------------|
| lunchportalen | **Production** | `app.lunchportalen.no` | `lunchportalen-ct5ccm64u` (2d, Ready) | `98b3b15e258966dd61ad967af5876982bcfcb959` | Production ref (not uigx) | Production dataset | **NO** |
| lunchportalen | **Staging** | `staging.app.lunchportalen.no` | `dpl_FvnXdRKhpSYJ6R5XRymZG2aKAmaj` (`q4obb1716`) | Missing/`unknown` pre-14C.2 fix | `uigxsboqeruxflgzqztl` | staging | **YES** (deploy/alias only) |
| lunchportalen | **Preview** | `*.vercel.app` | `dpl_9jVsHqiydHMJgLZsXECtDL6xBgrs` (`6g0mkitqe`, PR #489) | `5cf96d7457292976faac4a6decc8763baf0aa48f` | staging (when env wired) | staging | Read-only proof only |

---

## Production verification (Gate 0)

| Check | Result |
|-------|--------|
| Production SHA @ `app.lunchportalen.no/api/health` | `98b3b15e258966dd61ad967af5876982bcfcb959` |
| Production alias changed | **NO** |
| Production env changed | **NO evidence** |
| Production data changed | **NO** |
| Promoted production deployment completed | **NO** (removed) |
| `origin/main` | `98b3b15e258966dd61ad967af5876982bcfcb959` |

**Status:** PRODUCTION_INCIDENT_REQUIRES_REVIEW = **NO** — containment confirmed.

---

## Staging rollback reference

| Field | Value |
|-------|-------|
| Rollback deployment | `dpl_BF64w1x71L8eamnErJP4nHsxmk5C` (`lunchportalen-bst4qc854`) |
| Pre-14C.1 staging SHA (APP_VERSION env) | `bab39f148e1b93b5c4b25279023eab0a6952896e` |
| `origin/staging` (preserved) | `9a6b917e7099c21988da78a45c44c680b2a63edc` |

---

## Allowed Vercel write operations (Phase 14C.2)

1. `vercel deploy --target=staging -e APP_VERSION=<git-sha> --yes` from clean RC worktree
2. Explicit staging domain alias **only** after project/domain verification in this matrix
3. **Forbidden:** `vercel promote`, production target, production domain, force-push

---

*No secrets or env values in this document.*
