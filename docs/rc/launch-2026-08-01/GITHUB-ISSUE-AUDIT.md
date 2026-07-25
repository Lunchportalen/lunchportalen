# GitHub Issue audit — August 1 launch track

Stamped: 2026-07-25T17:45:00Z  
Release branch: `release/global-menu-universes-21`  
Engine SHA at audit: `d10f3e56cdf17a20c9ecf02c5f28e9f01e49a020`

## Counts before cleanup

| Metric | Value |
|---|---|
| Open Issues | 45 |
| Phase 15G.3E owner-action duplicates | 43 |
| Other open Issues | 2 (#501, #502) |
| Open PRs | 2 (#504, #505) |

## Classification

| Number | Title | Class | Action |
|---|---|---|---|
| 506–558 (43) | `[15G.3E] Owner action required — run …` | AUTOMATION_NOISE / DUPLICATE | Close; canonical status in `docs/rc/phase15g3e/OWNER-ACTIONS-CANONICAL.md` |
| 501 | Staging migration history drift | REAL_TECHNICAL_NONBLOCKER | Staging-only; track separately from Aug 1 prod deploy |
| 502 | Week-visual Playwright browser install | REAL_TECHNICAL_NONBLOCKER / CI | Staging visual CI; not prod release blocker |
| OA-15G3E-001 | Contract/payment batch ready | EXTERNAL_OWNER_DEPENDENCY | Keep as unique owner action in canonical doc (+ ≤1 Issue) |

## Required after cleanup

- `PHASE15G3E_DUPLICATE_ISSUES_OPEN = 0`
- `PHASE15G3E_CANONICAL_ISSUE_COUNT <= 1`
- `AUTOMATION_NOISE_ISSUES_OPEN = 0`
- `DUPLICATE_ISSUES_OPEN = 0`
