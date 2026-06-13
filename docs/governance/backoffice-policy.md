# Backoffice Policy

**Status**: Active  
**Version**: 1.0.0  
**Owner**: Thomas Lyng-Olsen  
**Last reviewed**: 2026-05-27  
**Next review**: 2026-08-27 (quarterly)  
**Compliance map**: ISO27001 Annex A.9, SOC2 CC6.1

## 1. Scope

Denne policy dekker **administrativ og operativ tilgang** til plattformens kontrollflater — ikke sluttbrukerroller (`employee`, `company_admin`, `kitchen`, `driver`). Produktroller håndteres i [access-control-policy.md](../security/access-control-policy.md) og [role-matrix.md](./role-matrix.md). To-system repo-kontekst: [../architecture/monorepo.md](../architecture/monorepo.md).

### In scope

| Surface | URL / entry | Primary auth | Notes |
|---------|-------------|--------------|-------|
| Next.js backoffice (CMS/control plane) | `app.lunchportalen.no/backoffice/*` | Supabase session; **superadmin** only (layout guard) | Content, media, releases, settings, AI control — se [surface-map-and-status.md](../backoffice/surface-map-and-status.md) |
| Superadmin (operational tower) | `app.lunchportalen.no/superadmin/*` | Supabase session; **superadmin** | Firma, system, kitchen oversight — server-side role guard |
| Company admin | `app.lunchportalen.no/admin/*` | Supabase session; **company_admin** | Tenant-scoped; ikke backoffice CMS |
| Umbraco backoffice | `lunchportalen.no/umbraco` | Umbraco identity | Headless CMS admin (separat deploy) |
| Supabase Studio | Supabase dashboard → project | Supabase org membership | DB/schema/RLS — **service role aldri i klient** |
| Deployment console | Vercel project dashboard | Vercel team membership | Preview + production deploy, env secrets |
| Azure App Service + Azure SQL | Azure portal / App Service Configuration | Azure AD / RBAC | Umbraco CMS (`lunchportalen-umbraco`) + marketing DB (`umbracoDbDSN` off-repo) — se [monorepo.md](../architecture/monorepo.md) |

### Out of scope

- Public site (`lunchportalen.no`, `/week`, onboarding)
- Customer tenant admin day-to-day (`/admin` for company_admin)
- Automated CI/service accounts (se [change-management-policy.md](./change-management-policy.md))

## 2. Roles and access

Backoffice-flater skiller seg fra produktrollene. **Kode sannhet:** `/backoffice/*` krever `superadmin` (fail-closed redirect). API under `/api/backoffice/**` håndhever `scopeOr401` + `requireRoleOr403(["superadmin"])` med mindre eksplisitt dokumentert unntak.

### Access register (owner-maintained)

| Person | Email | Surfaces granted | Role / vendor account | Granted | Last reviewed | Off-board date |
|--------|-------|------------------|------------------------|---------|---------------|----------------|
| [TBD] | [TBD] | [TBD] | [TBD] | [TBD] | [TBD] | — |

**Owner action required:** Thomas fyller access register ved neste kvartalsreview. Oppbevar master-liste utenfor repo (GRC/HR-system) hvis den inneholder persondata; denne tabellen er mal.

### Minimum privilege

- Umbraco: kun editor/admin som trenger innholdsstyring
- Supabase Studio: kun engineering + owner; read-only der mulig
- Vercel: deploy-tilgang begrenset; production secrets kun til nødvendige roller
- Superadmin i Lunchportalen: få navngitte operatører; ingen delte passord

## 3. Access controls

### Authentication

- **2FA påkrevd** for alle backoffice-konti (Umbraco, Supabase org, Vercel team, Azure)
- **Password rotation:** hver 90 dager for vendor-konsoller uten SSO
- **SSO:** [TBD — om/when aktivert per vendor]
- **Lunchportalen app:** passordreset kun via «Glemt passord» (single-use lenke); ingen admin-reset (se AGENTS.md S8)

### Session and authorization

- Server-side role guards i layouts — **ingen client-side auth redirects** for tilgangsbeslutninger
- Middleware gater kun uautentisert tilgang; rolle-landing via `/api/auth/post-login`
- Tenant scope: `profiles.company_id` (+ `location_id` der relevant) — aldri stol på client-sent `company_id`

### Network controls

- **IP-whitelist:** [TBD — beslutning per surface; Umbraco/Supabase/Vercel capabilities]
- **Rate limiting:** edge/deployment-platform defaults + API fail-closed (se [security-architecture.md](../security/security-architecture.md))
- **Audit logging:** `audit_events`, `authLog`, `rid` på API-responser — bruk ved hendelsestriage

## 4. Audit cadence

| Review | Frequency | Owner | Evidence |
|--------|-----------|-------|----------|
| Backoffice access register (§2) | Quarterly | Thomas | Oppdatert tabell + sign-off |
| Supabase/Vercel/Umbraco vendor membership | Quarterly | Thomas | Vendor dashboard export / screenshot |
| Role drift (superadmin profiles) | Quarterly | Thomas | Query `profiles` where role = superadmin; match access register |
| Policy review | Annual (Q1) | Thomas | Version bump + `Last reviewed` |
| Ad-hoc | On off-boarding or security incident | Thomas + engineering | Ticket + access revocation log |

Kvartalsreview skal bekrefte: ingen orphaned accounts, ingen uautorisert superadmin, 2FA aktiv på vendor-konsoller.

## 5. Deviation handling

### Off-boarding

1. Revoke Lunchportalen superadmin (deaktiver Supabase auth user + profile)
2. Remove from Umbraco, Vercel team, Supabase org, Azure RBAC
3. Rotate shared secrets hvis person hadde tilgang
4. Document in access register with off-board date

**Detailed HR/procurement flow:** [TBD — lenke til intern prosess]

### Compromise

1. Follow [incident-response.md](../security/incident-response.md) for engineering triage (`rid`, audit rows)
2. Escalate per [incident-response-plan.md](../security/incident/incident-response-plan.md)
3. Revoke affected sessions; rotate credentials; preserve audit trail
4. Post-incident: update access register + policy if control gap found

### Business continuity

If primary owner unavailable:

- **Backup admin:** [TBD — navngitt deputy + escrow for vendor ownership]
- **Escalation:** [TBD — styre/kontakt]
- Platform continuity: [business-continuity-plan.md](../security/incident/business-continuity-plan.md)

## 6. Change management

Endringer i denne policy krever:

- Documented justification
- Owner approval (Thomas)
- Updated mapping til ISO27001/SOC2 controls ([iso27001-alignment-matrix.md](../compliance/iso27001-alignment-matrix.md))
- Version bump i tracked-fields (§ header)
- `npm run check:links` PASS etter relative link-endringer

## Related documents

- [security-architecture.md](../security/security-architecture.md)
- [access-control-policy.md](../security/access-control-policy.md)
- [role-matrix.md](./role-matrix.md)
- [incident-response.md](../security/incident-response.md)
- [incident-response-plan.md](../security/incident/incident-response-plan.md)
- [business-continuity-plan.md](../security/incident/business-continuity-plan.md)
- [iso27001-alignment-matrix.md](../compliance/iso27001-alignment-matrix.md)
- [surface-map-and-status.md](../backoffice/surface-map-and-status.md)
- [SCOPE_LOCK.md](../backoffice/SCOPE_LOCK.md)
