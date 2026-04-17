# Enterprise-pakke — minimumssett (salgsklar due diligence)

**Formål:** Én inngang for **innkjøp, IT, sikkerhet og ledelse** uten å måtte lete i hele `docs/`. Innholdet **pakker og presiser** det som allerede finnes — det introduserer ikke nye produktløfter.

**Master Blueprint (uendret ansvar):** Umbraco = public/content · Sanity = meny/weekplan · Supabase = operativ sannhet · Next.js = experience/integrasjon. Se `AGENTS.md` for låste regler og RC-gates.

**Ubetinget enterprise-live (E0):** Salgs- og due diligence-pakken under er **ikke** det samme som «ubetinget enterprise-live» i E0-forstand. E0-tabellen (`docs/enterprise-ready/ENTERPRISE_LIVE_LIMITATIONS.md`) og rad-for-rad-fasit Closeout 12 (`docs/enterprise-ready/ENTERPRISE_LIVE_E0_CLOSEOUT_12.md`) fastholder **NO-GO** for ubetinget status frem til dokumenterte blokkere er lukket med bevis. **RC-/produktkjerne** vurderes i `docs/decision/MASTER_BLUEPRINT_FINAL_PARITY.md`.

---

## Minimum dokumenter (bruk denne rekkefølgen i dialog)

| Dokument | Publikum | Innhold |
|----------|----------|---------|
| [commercial-one-pager.md](./commercial-one-pager.md) | Økonomi / innkjøp | Binding, oppsigelse, minimum volum — **kort og eksplisitt** |
| [technical-security-overview.md](./technical-security-overview.md) | IT / sikkerhet | Arkitektur, roller, tenant, API-kontrakt, logging — **teknisk sannhet** |
| [../product/enterprise.md](../product/enterprise.md) | Bred ledelse | Multi-tenant, roller, revisjon/GDPR-rammer, observabilitet — **kontekst** |
| [../product/technical.md](../product/technical.md) | Ikke-utvikler teknisk | AI som støtte, dataflyt, TLS, pekere til dypere docs |
| [../security/README.md](../security/README.md) | Sikkerhet / revisjon | SOC2-kontekst, tenant, audit-dekning, hendelseshåndtering |

**Valgfritt / roadmap (ikke solgt som ferdig produkt):**

| Dokument | Merknad |
|----------|---------|
| [sso-roadmap.md](./sso-roadmap.md) | **Roadmap** — SAML/SCIM er ikke MVP-løfte |
| [../enterprise-ready/ENTERPRISE_LIVE_LIMITATIONS.md](../enterprise-ready/ENTERPRISE_LIVE_LIMITATIONS.md) | Intern: kjente begrensninger og NO-GO-kriterier for «ubetinget enterprise-live» |
| [../enterprise-ready/ENTERPRISE_LIVE_E0_CLOSEOUT_12.md](../enterprise-ready/ENTERPRISE_LIVE_E0_CLOSEOUT_12.md) | Intern: rad-for-rad E0-status (ingen falsk «lukket» uten bevis) |

---

## Live nå vs. senere lag

| Område | Live nå (typisk) | Senere lag / roadmap |
|--------|------------------|----------------------|
| Rollemodell, server-side guards, tenant-filter på operative data | Ja | — |
| API-kontrakt `{ ok, rid, … }`, fail-closed | Ja | — |
| Ordre, uke, kjøkken leseflate, company_admin rammer | Ja (RC) | — |
| SSO / SAML / SCIM | Nei | `sso-roadmap.md` |
| Full ekstern compliance-sertifisering (f.eks. SOC2 *attest*) | Kontekst-dokumentert | `docs/security/SOC2_CONTROL_MATRIX.md` beskriver *mapping*, ikke leverandør-attest i seg selv |
| K4-observabilitet som full incident-plattform | Delvis (`opsLog`, health) | Utvidet drift/alarm som produkt — se `AGENTS.md` Q17 K3 |

**AI:** Brukes til innhold, forslag og styrt beslutningsstøtte der det er implementert — **ikke** solgt som synlig sluttbrukerprodukt der det ikke er live. Se `docs/product/technical.md`.

**ESG / utvidet revisjon:** Leses opp mot faktisk implementerte flater og `docs/security/AUDIT_COVERAGE.md` — ikke som ubetinget full enterprise-revisorpakke uten avtalt scope.

---

## Konsistens mot kommersiell modell

Standard kommersielle rammer står i [commercial-one-pager.md](./commercial-one-pager.md) (12 mnd binding, 3 mnd oppsigelse, minimum 20 ansatte, ingen unntaksflate i standardmodellen). Avvik kun etter **eksplisitt** avtale — ikke antatt i generell salgsdialog.

---

## Verifikasjon i repo (bygg / RC)

Obligatoriske gates for endringskontroll er beskrevet i `AGENTS.md` (`typecheck`, `lint`, `build:enterprise`, `sanity:live` der relevant). Historiske kjøringer finnes bl.a. i `docs/enterprise-ready/ENTERPRISE_READY_VERIFICATION.md` — **punkt-i-tid**, ikke erstatning for å kjøre gates på gjeldende branch.

---

## Hva denne mappen ikke er

- Ikke en **ny roadmap** eller produktstrategi.
- Ikke erstatning for **kontrakt, DPA eller juridisk avklaring** — juridisk klarering forblir utenfor repo.
- Ikke **garanti** om at alle interne `enterprise-ready/*`-dokumenter er grønne; les `ENTERPRISE_LIVE_LIMITATIONS.md` for ærlig risiko.
