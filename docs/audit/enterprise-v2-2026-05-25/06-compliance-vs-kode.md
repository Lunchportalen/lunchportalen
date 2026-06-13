# Fase F — Compliance-dokumenter vs faktisk kode

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Metode:** READ-ONLY · cross-reference compliance-pack mot Fase C/D/E funn  
**Status:** SUB F.1 + F.2 + F.3 **COMPLETE** → STOP-PUNKT F

**Artifacts:**

- `scripts/audit/f1-unprotected-pages.mjs` — 31/207 sider uten middleware auth-gate
- [05-devops-full.md §E.3.5](./05-devops-full.md) — skip-auth cross-cut
- Root MD inventory: **73 filer** (repo root `*.md`, ekskl. `docs/`)

---

## Coverage-ledger (Fase F)

| Sub | Scope | Dokumenter åpnet | Coverage |
| --- | --- | ---: | ---: |
| **F.1.A** | X-Lp-Mw-Skip-Auth + public routes | `middleware.ts`, `apiAllowlist.ts`, 31 pages | 100% grep scope |
| **F.1.B** | Root MD inventory | 73 / 73 root `*.md` | 100% |
| **F.2** | Tier 1 DD docs (7) | SOC2, SoA, Threat, Pen-test, Red team, Zero trust, IR | 100% Tier 1 |
| **F.3** | Tier 2–3 + RFP + ESG | 5 policies + 4 ESG + RFP + 28 strategy/sales | Sample + count |

---

# SUB F.1 — Mini cross-reference + compliance-claim inventory

## F.1.A — X-Lp-Mw-Skip-Auth utbredelse

### Grep-resultat

```text
rg "skip.?auth|skipAuth|Skip-Auth|noAuth" app/ lib/ middleware.ts -i
```

| Område | Treff | Kommentar |
| --- | ---: | --- |
| `middleware.ts` | 1 prod | `x-lp-mw-skip-auth: 1` når `!needsAuth` (L148–151) |
| `app/` | 0 | Ingen consumer — pages stoler på middleware eller egen server guard |
| `lib/` | 0 | Relatert: `apiAllowlist.ts` (83 ruter, annen header) |
| Audit/tests | flere | Telemetri + kontrakt-tester |

**Konklusjon:** Skip-auth er **sentralisert** i middleware — ikke spredt ad hoc. **Gap:** *hvorfor* hver offentlig rute er offentlig er **ikke** dokumentert i compliance-pack.

### Public-by-design mønstre (3 lag)

| Lag | Mekanisme | Antall | Dokumentert? |
| --- | --- | ---: | --- |
| **Side — beskyttet prefix** | Redirect til `/login` uten sesjon | 9 prefixer (~176 sider) | Delvis (`AGENTS.md` E5) |
| **Side — skip-auth** | `X-Lp-Mw-Skip-Auth: 1`, ingen redirect | **31** sider | **Nei** (unntatt onboarding freeze i AGENTS) |
| **API — allowlist** | `x-lp-mw-bypass: allowlist`, route egen gate | **83** ruter | Delvis (DC-011 kommentar) |
| **API — default** | 401 JSON uten sesjon | ~460 øvrige | Ja (fail-closed API) |
| **Bypass statisk/login** | `isBypassPath()` | `/login`, `/status`, assets | Implisitt |

Full side-liste og prod-bevis: [05-devops-full.md §E.3.5](./05-devops-full.md).

### Funn

| ID | Sev | Funn |
| --- | --- | --- |
| F-MW-01 | **P1** | Compliance hevder «ingen tilgang via URL alene» — middleware tillater anonym tilgang til 31 sider inkl. mock `/dashboard` |
| F-MW-02 | P2 | 83 API allowlist-ruter uten buyer-facing matrix |
| F-MW-03 | P2 | `THREAT_MODEL.md` UTF-8 mojibake (I9) — **ikke DD-klar** |

---

## F.1.B — Root MD-filer inventory (73)

**Heuristikk AI vs menneske:**

- **AI-batch:** 62 filer med `LastWriteTime 2026-04-18`, emoji-seksjoner, «comprehensive/framework/roadmap», generiske tabeller, `YYYY-MM-DD`-placeholders, ingen fil-spesifikke linjereferanser.
- **Menneske/vedlikehold:** `AGENTS.md`, `DEVELOPER_ONBOARDING_GUIDE.md` (2026-05-24), `README.md`, `AGENTS_TLDR.md`, `REPO_DEEP_DIVE_REPORT.md`, `CODEX_*`, `CURSOR_*` (prompt-artefakter).

**Kategori-legend:** POLICY = styringsdok · STRATEGY = 3–5 år / GTM · EVIDENCE = skal bevise kontroll · TEMPLATE = tom/placeholder · ASPIRATIONAL = roadmap uten implementasjonsbevis · OUTDATED = motbevist av nåværende stack

### Oppsummering

| Kategori | Antall | AI-estimat | DD-relevans |
| --- | ---: | ---: | --- |
| POLICY | 18 | ~15 | Høy (Tier 1–2) |
| STRATEGY | 22 | ~20 | Medium (kjøper skim) |
| EVIDENCE | 8 | ~5 | **Kritisk** — mange placeholders |
| TEMPLATE | 7 | ~6 | Lav som bevis |
| ASPIRATIONAL | 14 | ~13 | Medium — må merkes «plan» |
| OUTDATED | 4 | ~3 | **Risiko** hvis sitert som nåtilstand |

### Full tabell (repo root)

| Fil | Linjer | Modifisert | Forfatter | Kategori |
| --- | ---: | --- | --- | --- |
| ACCESS_CONTROL_POLICY.md | 26 | 2026-04-18 | AI | POLICY |
| AGENTS.md | 581 | 2026-04-18 | Menneske | POLICY |
| AGENTS_TLDR.md | 127 | 2026-02-05 | Menneske | TEMPLATE |
| AI_KPI_FRAMEWORK.md | 156 | 2026-04-18 | AI | STRATEGY |
| AI_RISK_ASSESSMENT_FRAMEWORK.md | 158 | 2026-04-18 | AI | STRATEGY |
| AI_STRATEGY_INTERNAL_CONTROLLED.md | 163 | 2026-04-18 | AI | STRATEGY |
| ARCHITECTURE_DECISIONS.md | 208 | 2026-04-18 | Mixed | EVIDENCE |
| AUDIT_CALENDAR.md | 53 | 2026-04-18 | AI | TEMPLATE |
| BOARD_LEVEL_SUMMARY.md | 142 | 2026-04-18 | AI | STRATEGY |
| BUSINESS_CONTINUITY_PLAN.md | 159 | 2026-04-18 | AI | POLICY |
| CHANGE_MANAGEMENT_POLICY.md | 16 | 2026-04-18 | AI | POLICY |
| CHANGELOG.md | 2 | 2026-04-18 | Stub | EVIDENCE |
| CODEX_CHECKLIST.md | 105 | 2026-04-18 | Menneske | POLICY |
| CODEX_DATAWRITE.md | 118 | 2026-04-18 | Menneske | POLICY |
| COMPLIANCE_OVERVIEW.md | 164 | 2026-04-18 | AI | POLICY |
| COMPLIANCE_ROADMAP_12M_ISO.md | 163 | 2026-04-18 | AI | ASPIRATIONAL |
| CORRECTIVE_ACTIONS_LOG.md | 5 | 2026-04-18 | AI | TEMPLATE |
| COST_MODEL.md | 156 | 2026-04-18 | AI | STRATEGY |
| CRO_FRAMEWORK.md | 180 | 2026-04-18 | AI | STRATEGY |
| CURSOR_MASTER_PROMPT_LUNCHPORTALEN_V4.md | 606 | 2026-04-18 | Prompt | TEMPLATE |
| CURSOR_PHASED_PROMPTS_LUNCHPORTALEN_V5.md | 320 | 2026-04-18 | Prompt | TEMPLATE |
| DATA_FLOW_DIAGRAM.md | 241 | 2026-04-18 | AI | EVIDENCE |
| DATA_GOVERNANCE_POLICY.md | 179 | 2026-04-18 | AI | POLICY |
| design-system.md | 68 | 2026-04-18 | Mixed | POLICY |
| DEVELOPER_ONBOARDING_GUIDE.md | 173 | 2026-05-24 | Menneske | EVIDENCE |
| DISASTER_RECOVERY_PLAN.md | 177 | 2026-04-18 | AI | POLICY |
| DOCS_OVERVIEW.md | 73 | 2026-04-18 | AI | TEMPLATE |
| DRIFTSCODEX.md | 75 | 2026-04-18 | Menneske | POLICY |
| ENGINEERING_KPI_FRAMEWORK.md | 174 | 2026-04-18 | AI | STRATEGY |
| ENTERPRISE_AI_POSITIONING_BRIEF.md | 126 | 2026-04-18 | AI | STRATEGY |
| ENTERPRISE_CONTROL_MAP.md | 157 | 2026-04-18 | AI | EVIDENCE |
| ENTERPRISE_GTM_TECH_ALIGNMENT.md | 173 | 2026-04-18 | AI | STRATEGY |
| ENTERPRISE_RFP_MASTER_RESPONSE_TEMPLATE.md | 188 | 2026-04-18 | AI | TEMPLATE |
| ENTERPRISE_SALES_TECHNICAL_PACK.md | 172 | 2026-04-18 | AI | STRATEGY |
| ESG_KPI_FRAMEWORK.md | 132 | 2026-04-18 | AI | STRATEGY |
| ESG_SALES_NARRATIVE_PACK.md | 131 | 2026-04-18 | AI | STRATEGY |
| ESG_SUSTAINABILITY_TECHNICAL_BRIEF.md | 135 | 2026-04-18 | AI | STRATEGY |
| EVIDENCE_INDEX.md | 51 | 2026-04-18 | AI | TEMPLATE |
| EXECUTIVE_ESG_DASHBOARD_BLUEPRINT.md | 142 | 2026-04-18 | AI | ASPIRATIONAL |
| EXECUTIVE_MONITORING_DASHBOARD_BLUEPRINT.md | 171 | 2026-04-18 | AI | ASPIRATIONAL |
| GROWTH_AND_RISK_ALIGNMENT_BRIEF.md | 151 | 2026-04-18 | AI | STRATEGY |
| INCIDENT_RESPONSE_PLAN.md | 180 | 2026-04-18 | AI | POLICY |
| INTERNAL_AUDIT_TEMPLATE.md | 22 | 2026-04-18 | AI | TEMPLATE |
| INTERNAL_ENGINEERING_HANDBOOK.md | 169 | 2026-04-18 | AI | POLICY |
| INTERNAL_ENGINEERING_PLAYBOOK.md | 172 | 2026-04-18 | AI | POLICY |
| INVESTOR_SECURITY_BRIEF.md | 129 | 2026-04-18 | AI | STRATEGY |
| MANAGEMENT_REVIEW_TEMPLATE.md | 16 | 2026-04-18 | AI | TEMPLATE |
| MASTER_SECURITY_POLICY.md | 42 | 2026-04-18 | AI | POLICY |
| MISSION_CRITICAL_OPERATIONS_STANDARD.md | 179 | 2026-04-18 | AI | POLICY |
| PENETRATION_TEST_SCOPE_TEMPLATE.md | 177 | 2026-04-18 | AI | TEMPLATE |
| PLATFORM_VISION_DOCUMENT.md | 143 | 2026-04-18 | AI | STRATEGY |
| PRODUCT_ROADMAP_5Y_DETAILED.md | 167 | 2026-04-18 | AI | ASPIRATIONAL |
| README.md | 3 | 2026-01-26 | Menneske | EVIDENCE |
| RED_TEAM_SIMULATION_PLAYBOOK.md | 179 | 2026-04-18 | AI | TEMPLATE |
| REPO_DEEP_DIVE_REPORT.md | 500 | 2026-04-18 | Mixed | OUTDATED |
| RESPONSIBLE_AI_POLICY.md | 147 | 2026-04-18 | AI | POLICY |
| RISK_REGISTER.md | 216 | 2026-04-18 | AI | EVIDENCE |
| RISK_TREATMENT_PLAN.md | 61 | 2026-04-18 | AI | POLICY |
| RLS_POLICIES.md | 16 | 2026-04-18 | AI | OUTDATED |
| ROLE_MATRIX.md | 20 | 2026-04-18 | AI | OUTDATED |
| SCALABILITY_MODEL.md | 175 | 2026-04-18 | AI | STRATEGY |
| SECURITY_ARCHITECTURE.md | 173 | 2026-04-18 | Mixed | POLICY |
| SECURITY_STRATEGY_5Y.md | 141 | 2026-04-18 | AI | STRATEGY |
| SEO_STRATEGY_DOCUMENT.md | 179 | 2026-04-18 | AI | STRATEGY |
| SOC2_CONTROL_MATRIX.md | 153 | 2026-04-18 | AI | EVIDENCE |
| SOC2_PREPARATION_OUTLINE.md | 168 | 2026-04-18 | AI | ASPIRATIONAL |
| SOCIAL_MEDIA_PLAYBOOK.md | 154 | 2026-04-18 | AI | STRATEGY |
| STATEMENT_OF_APPLICABILITY_ISO27001.md | 178 | 2026-04-18 | AI | EVIDENCE |
| TECH_DUE_DILIGENCE_PACKAGE.md | 131 | 2026-04-18 | AI | EVIDENCE |
| TECHNOLOGY_STRATEGY_5Y.md | 177 | 2026-04-18 | AI | STRATEGY |
| THREAT_MODEL.md | 212 | 2026-04-18 | AI | EVIDENCE |
| UI_UX_GOVERNANCE.md | 166 | 2026-04-18 | AI | POLICY |
| VENDOR_MANAGEMENT_POLICY.md | 16 | 2026-04-18 | AI | POLICY |
| ZERO_TRUST_ROADMAP.md | 136 | 2026-04-18 | AI | ASPIRATIONAL |

**Pack-kvalitet:** ~85% av root compliance/strategy corpus er **ett-dags AI-batch (2026-04-18)** uten `Sist validert`-datoer — `EVIDENCE_INDEX.md` har fortsatt `YYYY-MM-DD` overalt.

---

# SUB F.2 — Tier 1 DEEP compliance-claims

**Klassifisering:** REELL · PARTIAL · ASPIRATIONAL · OUTDATED · **LYVENDE** (direkte motbevist av v2)

## Tier 1 — claim matrix

| Dokument | Claim | v2-evidence | Klassifisering |
| --- | --- | --- | --- |
| **SOC2 CC5** | «RLS enforcement» — Status: **Implementert** | Prod 232 policies; golden 190 stale (**C-RLS-01** 46/46 TRACKED i git) | **PARTIAL** — RLS finnes; drift-prosess svak |
| **SOC2 CC6** | Logical access — **Implementert** | Middleware skip-auth 31 sider; `/dashboard` mock public (**D-PAGE-01**, **E-MW-01**) | **PARTIAL** |
| **SOC2 CC8** | Change mgmt PR/CI — **Implementert** | **C-MIG-01** 31/98 (32%) APPLIED_OUTSIDE_GIT; **E-MIG-01** prod migrate on main push | **LYVENDE** → F-LYV-03 |
| **SOC2 CC9** | «Idempotency» UNIQUE+ON CONFLICT — **Implementert** | **C-FN-03** — kun `POST /api/orders` har lp_idem_* | **LYVENDE** → F-LYV-05 |
| **SOC2 §6** | «CI Hardening \| **Høy**» | **E-CI-01/02** — 3 pipelines; continue-on-error | **LYVENDE** → F-LYV-02 |
| **SOC2 §8** | «Teknisk fundament klart» / alle TSC **Implementert** | Overflatisk — ignorerer gaps over | **PARTIAL** — salgsnært |
| **SoA A.9** | Access — **IMPLEMENTED** | Samme som CC6 + ACCESS_CONTROL «ingen frontend-tilgang» | **PARTIAL** |
| **SoA A.10** | «Ingen hardkodede nøkler» | Tracked HEAD clean (**E-SEC-01**); 14 untracked `.env*` (**A-hygiene**) | **PARTIAL** |
| **SoA A.12** | Backup PITR — **IMPLEMENTED** | DR plan hevder PITR; **ikke restore-testet** i repo (v1 F3-11 carry) | **PARTIAL** |
| **SoA A.14** | Secure SDLC — **IMPLEMENTED** | Typecheck i CI ✓; strict mode ✗ (**D-TS-01**) | **PARTIAL** |
| **SECURITY_ARCHITECTURE §2.2** | «Ingen tilgang basert på URL alene» | `middleware.ts` skip-auth; prod `/dashboard` 200 anon | **LYVENDE** → F-LYV-01 |
| **THREAT_MODEL §2.1** | Auth bypass — **Risikonivå: Lav** | Mock admin-lignende UI uten sesjon; API fail-closed ✓ | **PARTIAL** — data-leak lav, **misleading UX høy** |
| **THREAT_MODEL §2.2** | Cross-tenant — **Lav** | RLS + tenant tests — konsistent med C/D | **REELL** (med C-RLS drift caveat) |
| **PENETRATION_TEST_SCOPE** | Scope for ekstern test | **Template only** — «før kontrahering» | **TEMPLATE** — ingen rapport |
| **RED_TEAM_PLAYBOOK** | Årlig simulering | Ingen logg, ingen `CORRECTIVE_ACTIONS` rader | **ASPIRATIONAL** |
| **ZERO_TRUST §Fase 1** | «Status i dag: RLS, RPC-only, CI-gates» | RLS/RPC **REELL**; «strammere CI-gates» **ikke** (**E-CI-02**) | **PARTIAL** |
| **ZERO_TRUST** | Full ZT på 3–5 år | Roadmap | **ASPIRATIONAL** |
| **INCIDENT_RESPONSE** | Oppdagelse via health/CI/monitoring | **E-OBS-01** — ingen ekstern paging; `/status` ≠ operator status | **PARTIAL** |
| **INCIDENT_RESPONSE** | On-call / eskalering | Ikke i repo; ingen PagerDuty/Slack wiring | **ASPIRATIONAL** |
| **TECH_DUE_DILIGENCE §7** | «**TypeScript strict mode**» | `tsconfig.json` `"strict": false`; **1819× `: any`** (**D-TS-01**) | **LYVENDE** → F-LYV-06 |
| **INTERNAL_ENGINEERING_HANDBOOK §3.1** | «Strict mode · Ingen `any`» | Samme som D-TS-01 | **LYVENDE** → F-LYV-07 |
| **ENTERPRISE_RFP §12** | «Har dere **gjennomført** sikkerhetstesting?» → playbook+template | Ingen pen-test rapport, ingen signert attestation | **LYVENDE** → F-LYV-04 |
| **ENTERPRISE_RFP §7** | «Ingen direkte produksjonsendringer» | C-MIG-01 + E-MIG-01 | **LYVENDE** → F-LYV-03 |
| **ENTERPRISE_RFP §4** | RTO/RPO `< 2–4t` / `< 5–15 min` | DR doc; **uverifisert** drill | **PARTIAL** |
| **Compliance (generelt)** | «Security headers configured» | **E-HDR-01** — ingen CSP på app | **PARTIAL** — ikke LYVENDE i SOC2 (ikke eksplisitt claim der); **LYVENDE** hvis RFP §2 impliserer full HTTP hardening |

### v2 cross-check (bruker-request)

| Påstand (typisk DD) | v2-funn | Verdict |
| --- | --- | --- |
| All changes via migrations / git | **C-MIG-01** 32% outside git | **LYVENDE** |
| RLS coverage complete | **C-RLS-01** golden stale; prod 232 vs git 190 snapshot | **PARTIAL** (policies finnes; governance gap) |
| Type-safe codebase | **D-TS-01** 1819 `: any`, strict false | **LYVENDE** (der hevdet) |
| Security headers configured | **E-HDR-01** no CSP | **PARTIAL** |
| Authenticated access only | **D-PAGE-01** + **E-MW-01** | **LYVENDE** (for employee shell) |

---

## P1 Risk Register — LYVENDE compliance-claims (DD-killers)

| ID | Sev | Claim (kilde) | v2 motbevis | DD-effekt |
| --- | --- | --- | --- | --- |
| **F-LYV-01** | **P1** | `SECURITY_ARCHITECTURE.md` §2.2 + `ACCESS_CONTROL` §3 «Ingen tilgang basert på URL / frontend» | 31 skip-auth sider; `/dashboard` 200 anon mock | Kjøper tester URL → ser «admin» UI uten login |
| **F-LYV-02** | **P1** | `SOC2_CONTROL_MATRIX.md` §6 «CI Hardening \| Høy» + CC4 Implementert | E-CI-01/02 | SOC2 narrative kollapser under 30 min teknisk DD |
| **F-LYV-03** | **P1** | `CHANGE_MANAGEMENT_POLICY` §2 + RFP §7 «Ingen direkte DB/prod-endringer» | C-MIG-01 32% outside git; E-MIG-01 auto prod push | Schema truth ≠ repo — audit trail-brudd |
| **F-LYV-04** | **P1** | `ENTERPRISE_RFP` §12 «Har dere gjennomført sikkerhetstesting?» | Kun template/playbook — **ingen** resultat/rapport | Klassisk sikkerhetsspørsmål — direkte falskt svar |
| **F-LYV-05** | **P1** | `SOC2` CC9 «Idempotency … Status: Implementert» | C-FN-03 — systemisk gap utenom orders POST | Processing integrity claim feil |
| **F-LYV-06** | **P1** | `TECH_DUE_DILIGENCE_PACKAGE.md` §7 «TypeScript strict mode» | `strict: false`, D-TS-01 | Due diligence pack ≠ `tsconfig` |
| **F-LYV-07** | **P1** | `INTERNAL_ENGINEERING_HANDBOOK.md` §3.1 «Ingen any» | 1819 `: any` | Intern policy ≠ kodebase |

**Anbefaling før DD:** Merk LYVENDE-rader som «Requires remediation or doc downgrade» — **ikke** send RFP-svar §12/§7 uendret.

---

# SUB F.3 — Tier 2 + Tier 3 + ENTERPRISE-RFP + ESG

## Tier 2 — policies (5)

| Dokument | Linjer | Claim-type | Klassifisering | v2-notat |
| --- | ---: | --- | --- | --- |
| ACCESS_CONTROL_POLICY.md | 26 | RBAC + RLS + kvartalsvis review | **PARTIAL** | Review ikke evidensiert; matcher DB-modell |
| DATA_GOVERNANCE_POLICY.md | 179 | GDPR, retention, minimering | **PARTIAL** | `lp_retention_cleanup` finnes; export/sletting delvis |
| VENDOR_MANAGEMENT_POLICY.md | 16 | DPA, Supabase/Vercel/Sanity | **PARTIAL** | Stub — ingen signerte DPA i repo |
| BUSINESS_CONTINUITY_PLAN.md | 159 | RTO, kommunikasjon, eskalering | **ASPIRATIONAL** | Ingen drill-logg |
| DISASTER_RECOVERY_PLAN.md | 177 | PITR, restore-sekvens | **PARTIAL** | PITR antatt via Supabase; **E-WORK-01** k8s/worker ikke prod |

## Tier 3 — Strategy / Sales / ESG (count)

| Bucket | Antall filer | AI-batch | Typisk klassifisering |
| --- | ---: | ---: | --- |
| Strategy (5Y, vision, tech, security, SEO) | 8 | 8/8 | ASPIRATIONAL |
| Sales / GTM / Investor | 6 | 6/6 | STRATEGY (narrativ) |
| ESG (`ESG_*` + executive blueprint) | **4** | 4/4 | **ASPIRATIONAL** (målt i doc, ikke i prod KPI) |
| Engineering / AI frameworks | 7 | 6/7 | STRATEGY |
| Executive blueprints | 2 | 2/2 | ASPIRATIONAL |
| Ops / UI / Social | 5 | 4/5 | POLICY/STRATEGY |

**Tier 3 total (root):** 32 filer — **0** med maskinlesbar KPI-feed eller `Sist validert` ≠ placeholder.

---

## ENTERPRISE_RFP_MASTER_RESPONSE_TEMPLATE.md

| Seksjon | Innholdstype | Verdict |
| --- | --- | --- |
| §1–3 Security/data | Peeker til ARCHITECTURE + policies | **Boilerplate** — delvis sann, mangler caveats |
| §4 Infra/RTO | DR/BCP referanser | **PARTIAL** — tall uten testbevis |
| §5 Incident | IR plan + **CORRECTIVE_ACTIONS** | **ASPIRATIONAL** — CA-logg tom |
| §6 Compliance | SOC2/ISO alignment | **OVERSTATEMENT** — matrix sier «Implementert» |
| §7 Change mgmt | PR + CI | **LYVENDE** vs C-MIG/E-MIG |
| §11 Scalability | 50k firma / 10M ansatte | **ASPIRATIONAL** — modell, ikke load proof |
| §12 Pen-test | Playbook + template | **LYVENDE** — spørsmål er perfektum |

**Konklusjon:** RFP-pakken er **strukturert boilerplate** egnet som *utkast*, **ikke** som signert enterprise-svar uten evidens-bilag.

---

## ESG_* — målt eller hevdet?

| Fil | Hva doc sier | Kode/data-bevis | Klassifisering |
| --- | --- | --- | --- |
| ESG_KPI_FRAMEWORK.md | Matsvinn %, cut-off compliance >95%, CO₂-estimat | `esg_*` tabeller/routes finnes (Fase C); **schema drift** rapportert i v1 | **PARTIAL** — framework > måling |
| ESG_SUSTAINABILITY_TECHNICAL_BRIEF.md | Datagrunnlag fra orders/snapshots | Avhenger av korrekt ESG read-model | **PARTIAL** |
| ESG_SALES_NARRATIVE_PACK.md | Salgsnarrativ | N/A | **ASPIRATIONAL** |
| EXECUTIVE_ESG_DASHBOARD_BLUEPRINT.md | UI blueprint | Ingen prod «executive ESG dashboard» bevis | **ASPIRATIONAL** |

**ESG DD-svar:** «Vi har **definert** KPI-er og delvis datagrunnlag; **ikke** tredjeparts-verifisert eller SOC-style evidenskjede.»

---

## OUTDATED arkitektur-referanser (Tier 2–3)

| Kilde | Død/gap referanse | v2 |
| --- | --- | --- |
| SCALABILITY_MODEL.md | Read replicas, partisjonering «roadmap» | OK som roadmap |
| REPO_DEEP_DIVE_REPORT.md | Pre-v2 middleware/auth beskrivelse | **OUTDATED** |
| RLS_POLICIES.md / ROLE_MATRIX.md | 16–20 linjer stub | **OUTDATED** — bruk Fase C policy dump |
| ZERO_TRUST Fase 3 | «Isoler cron i egen runtime» | **E-WORK-01** — workers ikke prod-bevist |
| k8s (`docs/audit` E.2) | Placeholder manifests | **OUTDATED** som prod-path |

---

# Fase F — funn-oppsummering

| ID | Sev | Rolle | Funn |
| --- | --- | --- | --- |
| F-LYV-01 | **P1** | COMPLIANCE | URL-alone access forbidden — motbevist (skip-auth) |
| F-LYV-02 | **P1** | COMPLIANCE | SOC2 «CI Hardening Høy» — motbevist |
| F-LYV-03 | **P1** | COMPLIANCE | No direct prod/DB changes — motbevist (migrations) |
| F-LYV-04 | **P1** | COMPLIANCE | RFP pen-test «gjennomført» — kun templates |
| F-LYV-05 | **P1** | COMPLIANCE | SOC2 idempotency implementert — motbevist |
| F-LYV-06 | **P1** | COMPLIANCE | Tech DD «strict mode» — motbevist |
| F-LYV-07 | **P1** | COMPLIANCE | Handbook «ingen any» — motbevist |
| F-MW-02 | P2 | COMPLIANCE | 83 API allowlist uten DD matrix |
| F-MW-03 | P2 | COMPLIANCE | THREAT_MODEL mojibake |
| F-PACK-01 | P2 | COMPLIANCE | 62/73 root MD samme dato — lav evidens-kvalitet |
| F-PACK-02 | P2 | COMPLIANCE | EVIDENCE_INDEX + CORRECTIVE_ACTIONS tomme |
| F-ESG-01 | P2 | COMPLIANCE | ESG KPI hevdet, ikke verifisert end-to-end |

---

## Completeness (F.1–F.3)

| Item | Status |
| --- | --- |
| F.1.A Skip-auth grep + route inventory | **COVERED** → §E.3.5 |
| F.1.B 73 root MD inventory | **COVERED** |
| F.2 Tier 1 claim matrix + LYVENDE P1 | **COVERED** |
| F.3 Tier 2/3 + RFP + ESG | **COVERED** |

---

## STOP-PUNKT F

**Fase F COMPLETE.**

**Kumulativ P1 etter F:** **21** unike (E-MW-01 = F-LYV-01 tellt én gang).

**Neste:** Vent **`GO Fase G`** (Umbraco/marketing headers) eller **`GO Fase H`** (Sanity studio).

*READ-ONLY — ingen compliance-doc eller kode endret i produksjon.*
