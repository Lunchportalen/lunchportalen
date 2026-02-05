# LUNCHPORTALEN — AGENTS_TLDR.md
Quick Orientation · Read This First · No Exceptions

This file is a **TL;DR guide** for working on **Lunchportalen.no**.  
It is **NOT authoritative**.

👉 **If there is any conflict, `AGENTS.md` ALWAYS wins.**

---

## WHAT THIS IS
- A **quick orientation** for humans and AI agents
- A reminder of **what is allowed vs forbidden**
- A guard against wasting time or breaking frozen systems

## WHAT THIS IS NOT
- Not a rulebook
- Not a place to add new laws
- Not allowed to override `AGENTS.md`

---

## CORE STATUS (NON-NEGOTIABLE)

- Lunchportalen is **LIVE (RC – Release Candidate)**
- Focus is **enterprise hardening**, not feature building
- “Correct” is not enough → must be **resilient, elegant, inevitable**
- CI Enterprise is the **final authority**

If CI is green → **STOP**.

---

## BEFORE YOU TOUCH ANY CODE

You MUST:
1. Read **AGENTS.md**
2. Identify if the target area is **FROZEN**
3. Identify impacted flows (**10 back · 10 forward**)
4. Identify the exact gate you are trying to pass
5. If gates are already **PASS** → **DO NOTHING**

No “just checking”.  
No “small improvement”.

---

## ABSOLUTE DO-NOT-DO LIST

❌ No speculative refactors  
❌ No feature creep  
❌ No UI changes in frozen flows  
❌ No guard / auth / routing changes unless explicitly ordered  
❌ No bypassing CI or audit rules  
❌ No client-side auth logic  
❌ No cross-tenant assumptions  
❌ No “it works locally” arguments  

If uncertain → **FAIL CLOSED**.

---

## FROZEN MEANS FROZEN

If a flow is frozen:
- You **do not touch logic**
- You **do not touch routing**
- You **do not touch guards**
- You **do not touch data contracts**

Allowed after freeze:
- **TEXT ONLY** (language, UTF-8 fixes)
- **UI ONLY** (spacing, visual calm)

Everything else → **STOP**.

---

## SYSTEM EMAIL (IMPORTANT)

- ALL system emails live in:  
  `lib/system/emails.ts`
- No email literals or constants anywhere else
- CI audit `SYSTEM_EMAIL` is authoritative
- Bypassing this is forbidden

---

## ROLE & TENANT TRUTH

- Roles:
  - `superadmin` → full system
  - `company_admin` → own company only
  - `employee` → own orders / week
  - `driver` → driver tools only

- Never trust client data
- Every query filters by `company_id` (and `location_id` where relevant)
- Zero cross-company leakage. Ever.

---

## API CONTRACT (LOCKED — DO NOT DEVIATE)

Every API response must be:
- Success: `{ ok: true, rid, data }`
- Error: `{ ok: false, rid, error, message, status }`

No silent fallbacks.  
No guessing.

---

## CI = TRUTH

A change is **DONE only when CI Enterprise is green** on the same commit.

Mandatory order:

npm run typecheck
npm run lint
npm run build:enterprise


Local green ≠ done.

---

## UI QUICK RULES

- One H1 per view
- 1–3–1 rule:
  - 1 H1
  - 3 signals
  - 1 primary action
- One accent color only: **HOT PINK**
- Exactly ONE primary action may use accent
- UI must feel calm, expensive, predictable

If UI needs explanation → **FAIL**.

---

## HIGH-RISK FILES (BE CAREFUL)

Edits require explicit justification:
- `middleware.ts`
- `/api/auth/post-login`
- `/login`
- admin / superadmin layouts
- canonical header components
- frozen flow files

Minimal diff only.  
Non-regression checklist required.

---

## DEBUGGING RULE

- Capture logs
- Capture full redirect chain
- Identify source: middleware vs server vs client
- Eliminate client redirects first
- Never guess

---

## WHEN IN DOUBT

- Stop
- Re-read **AGENTS.md**
- Check CI
- Ask **before** changing frozen logic

---

## FINAL REMINDER

This file helps you **navigate**.  
It does **not decide**.

👉 **AGENTS.md is the law.**

Build something competitors envy.  
Build something inevitable.