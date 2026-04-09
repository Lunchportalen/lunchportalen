# Umbraco parity — traffic light matrix

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| CMS as main base | GREEN | `/backoffice`, shells, CP docs | Hub for superadmin | Vedlikehold IA |
| Company/customer/agreement/location connectivity | YELLOW | Domain surfaces | Mutasjon utenfor CMS | Routing + runbook |
| Week/menu publishing from CMS | GREEN | CP7 + week-menu | Sanity kilde | Token policy |
| Employee Week safety | GREEN | `GET /api/week` uendret | Ingen weekPlan som order source | Regressjonstester |
| Content/publish safety | GREEN | Workspace | Uendret i denne runden | — |
| Media and design scopes | GREEN | Media routes | Uendret | — |
| Company admin runtime | YELLOW | Egen app | Ikke samme shell | Lenke-fortelling |
| Kitchen runtime | GREEN | RO + tower | Uendret | — |
| Driver runtime | GREEN | RO + tower | Uendret | — |
| Superadmin runtime | GREEN | Hub | Uendret | — |
| Social module | YELLOW | Posture | Kan være LIMITED | Ærlig UI |
| SEO module | GREEN | Content chain | Uendret | — |
| ESG module | YELLOW | Read APIs | Scope superadmin | — |
| Access/security | GREEN | Layout gate | Uendret | — |
| Cron/worker/job safety | YELLOW | Diverse | Utenfor denne runden | Monitor |
| Support/ops | YELLOW | Docs | Nye parity-docs | Drift |
| Scale confidence | GREEN | Ingen ny DB | Stateless broker | — |
| Overall enterprise coherence | YELLOW | Dual model | GO WITH CONDITIONS | IA + runbooks |
