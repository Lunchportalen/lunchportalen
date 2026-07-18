# Phase 18 — Owner Capacity Test Packet

**Status:** Prepared only. Not executed in Phase 17MENU.2B.  
**GLOBAL_SCALE_CERTIFIED = NO** until this packet passes in an isolated environment.

## Purpose

Certify Lunchportalen under large concurrent load without touching production customer traffic.

## Isolated target (mandatory)

| Constraint | Value |
|---|---|
| Environment | Dedicated load project OR staging clone |
| Production | Forbidden |
| Customer PII | Forbidden |
| Destructive soak | Allowed only on isolated synthetic data |

## Scale envelope

- 1,000 catering providers
- 2,000 customer companies
- Multiple tens of thousands of employees
- Simultaneous order spikes
- ≥ 50,000 cancellations
- Local 08:00 cutoff spikes (all 21 country time zones / DST)
- Hot-provider skew
- Hot-company skew
- Hot-dish capacity races
- Queue saturation
- Database connection pressure
- Production snapshot freeze under load
- Financial reversal reconciliation after mass cancel
- 8–24 hour soak
- Controlled failure injection + recovery

## Required pass criteria (summary)

- Capacity oversell = 0
- Cross-tenant leakage = 0
- Idempotency duplicates = 0
- Cutoff decision mismatch = 0
- Commission remainder loss = 0
- Refund/reversal total difference = 0
- No production alias / production DB involvement

## Preconditions from 17MENU.2B

- Exact recipe banks + entitlement runtime proven on staging
- Functional concurrency canaries green
- Exact 500 bps commission path proven on synthetic flows

## Owner approval gates

- `PHASE18_SCALE_EXECUTION = APPROVED` (not granted in 17MENU.2B)
- Dedicated infra budget / paid load resources if required
