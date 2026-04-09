# E0 — Enterprise live traffic light

**Dato:** 2026-03-29

| # | Kategori | Status | Evidence | Why | Blocks unconditional GO? |
|---|----------|--------|----------|-----|--------------------------|
| 1 | Access & security | **YELLOW** | Mønstre + delvise tester | Stor flate | **Ja** |
| 2 | Role enforcement | **YELLOW** | API guards; ikke middleware-rolle | A1 | **Ja** |
| 3 | Employee Week safety | **GREEN** | `lib/week`, tester | B1 fortsatt arkitektonisk | **Delvis** (B1) |
| 4 | Onboarding / pending / activation | **GREEN** | Frosset; tester | — | **Nei** |
| 5 | Billing / invoicing | **YELLOW** | Unit/integration | Økonomi-QA | **Ja** |
| 6 | Content / publish | **YELLOW** | CMS-tester | Kompleksitet | **Ja** |
| 7 | CMS / backoffice stability | **YELLOW** | build + tester | Stor overflate | **Ja** |
| 8 | Company admin runtime | **GREEN** | Scope-tester | — | **Nei** |
| 9 | Kitchen runtime | **GREEN** | `tests/kitchen/**` | — | **Nei** |
| 10 | Driver runtime | **GREEN** | `tests/driver/**` | — | **Nei** |
| 11 | Superadmin runtime | **YELLOW** | Tester | Høy makt | **Ja** (prosess) |
| 12 | Social calendar | **GREEN** | DB | — | **Nei** |
| 13 | Social publish | **RED** | DRY_RUN mulig; stubs policy | Ikke alltid ekstern effekt | **Ja** |
| 14 | SEO runtime | **YELLOW** | Review-first | Ikke auto-live | **Ja** |
| 15 | ESG runtime | **YELLOW** | API + tom data risiko | D3 | **Ja** |
| 16 | Cron / worker / outbox | **RED** | Cron OK; **worker stubs** | E1 | **Ja** |
| 17 | Observability / alerting | **YELLOW** | Logging; ingen full SLA | Org | **Ja** |
| 18 | Backup / restore | **YELLOW** | Doc/runbook | Ikke kodet bevis | **Ja** |
| 19 | Performance / scale confidence | **RED** | Ingen lasttest | F1 | **Ja** |
| 20 | Support / incident readiness | **YELLOW** | Runbook | Ikke bevist respons | **Ja** |

**Konklusjon:** Minst én **RED** + flere **YELLOW** som ikke er lukket → **NO-GO** for ubetinget enterprise-live.
