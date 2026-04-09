# CP3 — Traffic light matrix

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| CMS as main base | **GREEN** | `/backoffice/domains`, control page, TopBar | Én hub for moduler og status | Vedlikehold narrativ ved nye moduler |
| Company/customer/agreement/location connectivity | **YELLOW** | Read-only panels; superadmin for mutasjon | Korrekt scope — ikke full CRM i CMS | Optional: dypere lenker til superadmin kontekst |
| Week/menu publishing from CMS | **YELLOW** | Studio + week-menu; ingen duplikat kilde | Governance via Sanity + docs | Unngå fremtidig dobbel kilde uten RFC |
| Employee Week safety | **GREEN** | `/api/week` uendret | Ingen ny sannhet i CMS | Ingen — ikke regress |
| Content/publish safety | **GREEN** | Eksisterende content workspace | Uendret i CP3 | Fortsett review-first |
| Media and design scopes | **GREEN** | Backoffice media | Uendret | — |
| Company admin runtime | **GREEN** | Egen `/admin` | Uendret | — |
| Kitchen runtime | **GREEN** | Egen `/kitchen` | Uendret | — |
| Driver runtime | **GREEN** | Egen `/driver` | Uendret | — |
| Superadmin runtime | **GREEN** | Lenket fra CMS | Uendret | — |
| Social module | **YELLOW** | `DRY_RUN` / policy | Ærlig merking | Produksjonskobling når klart |
| SEO module | **YELLOW** | `LIMITED` | Review-first | Batch/editor forbedringer senere |
| ESG module | **YELLOW** | `LIMITED` | Data krever tolkning | Review-first |
| Access/security | **YELLOW** | Superadmin på domain loader | God for denne flaten | Global audit separat |
| Cron/worker/job safety | **RED** | `worker` STUB i statusdata | Delvis ikke implementert | Implementer eller isoler |
| Support/ops | **YELLOW** | Dokumentasjon + runtime sider | Ikke full runbook | Utvid ved behov |
| Scale confidence | **YELLOW** | Ikke lasttestet i CP3 | Ingen bevis | Profilering senere |
| Overall enterprise coherence | **YELLOW** | CP3 broer på plass | Nær «CMS-led coherent» med vilkår | Se CP3_NEXT_STEPS |
