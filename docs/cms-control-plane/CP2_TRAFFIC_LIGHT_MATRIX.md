# CP2 — Trafikklys-matrix

**Dato:** 2026-03-29

| Kategori | Status | Evidence | Why | Required action |
|----------|--------|----------|-----|-----------------|
| CMS as main base | **YELLOW→GREEN-ish** | TopBar Runtime + Uke & meny, runtime page | Dypere IA | Fortsett kohærens |
| Company/agreement/location connectivity | **YELLOW** | `loadControlPlaneRuntimeSnapshot`, runtime page | Read-only aggregater | Full mutasjon fortsatt superadmin |
| Week/menu publishing from CMS | **YELLOW** | `week-menu/page.tsx`, Sanity Studio lenke | Styring via Studio, ikke ny DB | Produkt: ev. inline editor |
| Employee Week safety | **GREEN** | Ingen endring i `GET /api/week` | Uendret | — |
| Content/publish safety | **GREEN** | Ingen ny publish-mutasjon | — | — |
| Media and design scopes | **GREEN** | Uendret | — | — |
| Company admin runtime | **GREEN** | Lenke fra runtime | Superadmin kan åpne /admin | — |
| Kitchen runtime | **GREEN** | Lenke + docs | — | — |
| Driver runtime | **GREEN** | Lenke + docs | — | — |
| Superadmin runtime | **GREEN** | Lenker hub | — | — |
| Social module | **YELLOW** | DRY_RUN i strip | Stub/keys | Integrasjon eller policy |
| SEO module | **YELLOW** | LIMITED | Batch+editor | — |
| ESG module | **YELLOW** | LIMITED | Aggregater | — |
| Access/security | **YELLOW** | Uendret A1/A2 | — | Egen hardening-fase |
| Cron/worker/job safety | **RED** | Worker stubs | — | Implementer/disable |
| Support/ops | **YELLOW** | Runbooks | — | Org |
| Scale confidence | **YELLOW** | Ingen lasttest | — | Definer |
| Overall enterprise coherence | **YELLOW** | CP2 broer | Nærmere «coherent» | Worker + gates |
