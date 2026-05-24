# Enterprise Audit v2 — Coverage Ledger

**Start:** 2026-05-25  
**Metode:** Hver-fil staff-level (BACKEND · FRONTEND · DEVOPS)  
**Erstatter:** `archive/audit-v1-shallow/` (pattern-scan v1)

---

## Fase-status

| Fase | Fil | Status | Filer åpnet | Coverage | STOP |
| --- | --- | --- | ---: | ---: | --- |
| **A** | [01-spike-cleanup.md](./01-spike-cleanup.md) | **COMPLETE** | 95 / 95 | 100% | ✅ STOP A |
| **B** | [02-monorepo-anatomi.md](./02-monorepo-anatomi.md) | **COMPLETE** | 45 / 45 | 100% | ✅ STOP B |
| **C** | [03-backend-full.md](./03-backend-full.md) | **COMPLETE** | 267 mig + 385 fn + 232 RLS + C-RLS-01 verify | 100% | ✅ STOP C |
| **D** | [04-frontend-full.md](./04-frontend-full.md) | **COMPLETE** | 207 pages + 543 routes + D-PAGE-01 verify | 100% | ✅ STOP D |
| **E** | [05-devops-full.md](./05-devops-full.md) | **COMPLETE** | 15 workflows + infra + headers VOC | 100% | ✅ STOP E |
| **F** | [06-compliance-vs-kode.md](./06-compliance-vs-kode.md) | **COMPLETE** | 73 root MD + 7 Tier-1 + skip-auth cross-cut | 100% | ✅ STOP F |
| **G** | [07-umbraco-marketing.md](./07-umbraco-marketing.md) | **COMPLETE** | umbraco17 + prod curls + G.7 eskalering | 100% | ✅ STOP G |
| **H** | [08-sanity-studio.md](./08-sanity-studio.md) | **COMPLETE** | 11 schemas + 17 GROQ + webhook v2 | 100% | ✅ STOP H |
| **I** | [99-executive-summary-v2.md](./99-executive-summary-v2.md) | **COMPLETE** | §1–11 + CONDENSED | 100% | ✅ STOP I |

**Audit v2 A–I: LUKKET.** Operativ oppfølging: §2 P0 (eier bruker).

---

## Fase A — spike/tmp (2026-05-25)

| Metrikk | Verdi |
| --- | --- |
| Kandidat-filer inventert (A.1) | 95 |
| Eksplisitt åpnet + kategorisert | 95 |
| Pattern-only (ikke åpnet) | 0 |
| SECRET i **tracked** fil | **0** → ingen P0 STOP |
| SECRET i **untracked** workspace | **14 env + 2 meta** → P1 hygiene |
| `.commit_msg_*.txt` åpnet | 40 / 40 |

---

## Kumulativ funn-telling (v2)

| Severity | BACKEND | FRONTEND | DEVOPS | COMPLIANCE | MARKETING | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **P0** | 0 | 0 | 0 | 0 | **2** | **2** |
| P1 | 4 | 2 | 9 | 6 | 1 | **22** |
| P2 | 12 | 12 | 16 | 4 | 9 | **53** |
| P3 | 4 | 3 | 4 | 0 | 0 | **11** |

**P0 (MARKETING):** G-KONTAKT-01 (`/kontakt/` 500) · G-LEGAL-01 (legal pages 404) — eskalert 2026-05-25.

*v2 IDs: A-*, B-*, C-*, D-*, E-*, F-*, G-*, H-* (se phase docs).*

---

## Fase G — Umbraco marketing (2026-05-25)

| Metrikk | Verdi |
| --- | --- |
| Prod stack | Umbraco **17.3.4** · .NET 10 · Azure `lunchportalen-umbraco` |
| F3-04 re-verify | **BEKREFTET** → G-HDR-01 |
| `/kontakt/` prod | **500** |
| Legal pages (personvern/vilkar/sikkerhet) | **404** |
| Backoffice URL | `/umbraco/login` **200** (ikke obfuskert) |
| Nye P1 | G-HDR-01 |
| **P0 (eskalert)** | G-KONTAKT-01, G-LEGAL-01 |

---

## Fase H — Sanity studio (2026-05-25)

| Metrikk | Verdi |
| --- | --- |
| Schema types | 11 (all opened) |
| GROQ call sites | 17 queries |
| Webhook v2 | **PASS** (`H-WEB-01`) |
| Nye P2 | H-CLOSED-01, H-CACHE-01, H-IMG-01, H-ACL-01, H-ACL-02, H-LYV-01 |

---

## Fase I — Executive summary (2026-05-25)

| Leveranse | Fil |
| --- | --- |
| Full §1–11 | [99-executive-summary-v2.md](./99-executive-summary-v2.md) |
| 1-side ekstrakt | [99-executive-summary-CONDENSED.md](./99-executive-summary-CONDENSED.md) |
| Scorecard | **105 / 200** |
| v1 sammenligning | 38 funn → **88** funn; P0 **0→2** |

---

## Neste (operativt)

Utfør **§2 P0** — eier bruker, denne uken (utenfor audit-pacing).
