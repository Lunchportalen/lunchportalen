# CP10 — Traffic light matrix

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| CMS as main base | **YELLOW** | Backoffice shell + CP10 nav-kilde + content workspace | Global søk mangler | Indeks eller avklart klient-scope |
| Company/customer/agreement/location connectivity | **YELLOW** | Ruter + kort; runtime sannhet uendret | Ikke full «editor» i CMS for alt | Behold runtime; forbedre IA etter behov |
| Week/menu publishing from CMS | **GREEN** | Eksisterende kjede + `operationalWeekMenuPublishChain` tester | — | Vedlikehold |
| Employee Week safety | **GREEN** | Uendret; uke-tester | CP10 rørte ikke employee | — |
| Content/publish safety | **GREEN** | `publishFlow`, persistence-tester | Palett muterer ikke | — |
| Media and design scopes | **YELLOW** | Media routes; design i content | Ingen global palett-søk i assets | Valgfri forbedring |
| Company admin runtime | **GREEN** | Egne guards/tester | Uendret av CP10 | — |
| Kitchen runtime | **GREEN** | Kitchen-tester | Uendret | — |
| Driver runtime | **GREEN** | Driver-tester | Uendret | — |
| Superadmin runtime | **GREEN** | Superadmin API-tester | Uendret | — |
| Social module | **YELLOW** | Modul + posture tests | Kan være LIMITED | Ærlig badge + backend |
| SEO module | **YELLOW** | SEO routes/tester | Avhenger av datakilde | Overvåk |
| ESG module | **YELLOW** | ESG routes/tester | Ofte read/summary | Overvåk |
| Access/security | **GREEN** | Backoffice layout guard; AI 403-tester | Palett = navigasjon only | — |
| Cron/worker/job safety | **GREEN** | Eksisterende cron-tester | CP10 ingen endring | — |
| Support/ops | **YELLOW** | Docs + health tests | Ingen ny runbook i CP10 | Ved behov |
| Scale confidence | **YELLOW** | Build + tester | Global søk skalerer ikke med klientliste alene | Planlegg indeks hvis krav |
| Overall enterprise coherence | **YELLOW** | CP10 styrker navigasjon | Fortsatt flere kontroll-kilder (Postgres/Sanity) | Tydelig språk i UI |
