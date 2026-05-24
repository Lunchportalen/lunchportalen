# Enterprise Audit v2 — Condensed (1 side)

**Dato:** 2026-05-25 · Full rapport: [99-executive-summary-v2.md](./99-executive-summary-v2.md)

---

## Verdict

**Seriøst produkt · håndterbar teknisk gjeld · aktiv prod-broken · compliance-fasade som ikke tåler DD.**

**DD i dag vil mislykkes** uten P0-fix + compliance-rebrand. **Score: 105/200.**

---

## P0 — denne uken (eier: ledelse)

| ID | Problem | Handling |
| --- | --- | --- |
| **G-KONTAKT-01** | `/kontakt/` → **500** | Azure/Umbraco logs → hotfix (4–10 t) |
| **G-LEGAL-01** | personvern/vilkår/sikkerhet → **404** | Stub-sider i Umbraco (3–4 t) |
| — | Ingen monitor på marketing | UptimeRobot 5 min × 4 URL (~5 min) |

---

## Telling v2 vs v1

| | P0 | P1 | P2 | Sum |
| --- | ---: | ---: | ---: | ---: |
| **v1** | 0 | 15 | 22 | 38 |
| **v2** | **2** | **22** | 53 | 88 |

---

## 3 DD-killers (nytt i v2)

1. **8 LYVENDE-lignende compliance-claims** (SOC2 «Implementert», RFP pen-test, strict TS, m.m.) — **ikke send docs uendret**
2. **Marketing brann** — kontakt 500 + legal 404 + ingen HSTS (`lunchportalen.no`)
3. **Prosess** — 32% migrasjoner uten git · CI continue-on-error · staging FIX ≠ main

---

## 30 dager → tryggere DD (~35 t minimum)

1. Lukk P0  
2. **STRIP/DOWNGRADE** SOC2, RFP, Tech DD, Handbook (§3 checklist)  
3. CI blocking (E-CI-02) + merge staging→main  
4. Umbraco HSTS/CSP + fjern/mock `/dashboard`  

---

## Det som faktisk fungerer (ikke riv)

RLS 46/46 sample tracked · 0 DEFINER uten search_path · 0 tracked secrets · Sanity+Tripletex webhook HMAC · 267 migrasjoner uten CASCADE · motion 120/200ms · fail-closed API middleware · order RPC-only

---

## K6

**Stress 100 VU: PARKÉR.** Baseline etter: P0 + CI fix + deploy + pool review.

---

*Board/investor: les §1 + §3 i full doc før datarom.*
