# CP7 — Action routing expansion

Utvidelse av CP6-matrisen: eksplisitt **safe CP7 action-routing** uten ny runtime-sannhet.

| Domain | Current source of truth | Current CMS surface | Current action posture | Safe CP7 action-routing | Risk |
|--------|-------------------------|---------------------|------------------------|---------------------------|------|
| Companies / customers | Supabase `profiles`, `companies`, views | `/backoffice/customers`, domain cards | Read + lenker | Behold read-only; CTA til eksisterende admin/superadmin der mutasjon finnes | Medium hvis scope lekker |
| Agreements | Supabase avtaler + `company_current_agreement` | `/backoffice/agreement-runtime` | Read + forklaring | Routing til admin-avtaleflyt; **ikke** dupliser avtale-API | High hvis dobbel mutasjon |
| Locations | Supabase `locations` m.m. | Domain surfaces | Read/lenke | CTA til company admin / runtime | Medium |
| Menus / meal types | Sanity `menu`, `menuContent` | `/backoffice/week-menu` | Studio handoff + CP7 broker | **Publish** via `POST .../sanity/menu-content/publish` (superadmin + token) | Low ved fail-closed |
| Week publishing | Sanity publish + ev. synlighet | Orkestrator + panel | Publish control | Samme Actions som Studio; dokumentert | Low |
| Company admin | Supabase scope | Control tower / domains | Runtime UI | Eksplisitte lenker til `/admin/*` | Medium |
| Kitchen | Supabase ordrer/aggregater | Backoffice kitchen surface | Read-only + routing | Kun navigasjon til `/kitchen` | Low |
| Driver | Supabase leveranser | Backoffice driver surface | Read-only + routing | Kun navigasjon til `/driver` | Low |
| Superadmin | Rolle + service routes | Backoffice modules | Full verktøy | Uendret; CMS som koordinator | Low |
| Social | Konfig + ev. jobber | Growth posture UI | LIMITED / honest | Ingen nye poster uten backend | Medium |
| SEO | Innhold + scripts | Content SEO panel | Redaksjonelt | Eksisterende publish-pipeline | Low |
| ESG | Lesing API | `/backoffice` ESG routes | Read-only superadmin | Behold read; ingen falsk «write» | Low |

**CP7-kodeendring:** primært **menus / week publishing**-raden (broker). Øvrige rader dokumentert for samsvar og fremtidig UI-tekst.
