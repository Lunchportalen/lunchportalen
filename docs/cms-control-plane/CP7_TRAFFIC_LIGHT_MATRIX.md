# CP7 — Traffic light matrix

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| CMS as main base | GREEN | Backoffice routes + week-menu | Orkestrator + broker | Vedlikehold dokumentasjon |
| Company/customer/agreement/location connectivity | YELLOW | Domain surfaces | Mye read-only | Tydeliggjør routing videre |
| Week/menu publishing from CMS | GREEN | API + UI + Sanity Actions | Én publish-semantikk | Sett token i prod |
| Employee Week safety | GREEN | `app/api/week/route.ts` uendret | Ingen weekPlan som order source | Overvåk regressjonstester |
| Content/publish safety | GREEN | Eksisterende gates | Uendret i CP7 | — |
| Media and design scopes | GREEN | CP6 baseline | Uendret | — |
| Company admin runtime | YELLOW | Eksterne admin-ruter | Ikke konsolidert i én CMS-side | Runbook |
| Kitchen runtime | GREEN | Read/routing | Uendret | — |
| Driver runtime | GREEN | Read/routing | Uendret | — |
| Superadmin runtime | GREEN | Broker gate | Superadmin only | Token policy |
| Social module | YELLOW | Posture docs | Kan være LIMITED | Ikke overlov |
| SEO module | GREEN | Content pipeline | Uendret | — |
| ESG module | YELLOW | Read APIs | Scope superadmin | — |
| Access/security | GREEN | scopeOr401 + role | Ny rute fulgte mønster | Periodisk audit |
| Cron/worker/job safety | YELLOW | Diverse | Ikke CP7 scope | Monitor |
| Support/ops | YELLOW | Delvis dokumentert | Broker er ny | Runbook |
| Scale confidence | GREEN | Ingen ny DB | Stateless API | — |
| Overall enterprise coherence | YELLOW | GO WITH CONDITIONS | Token + visibility edge cases | Lukk punkt 5 i CP7_DECISION |
