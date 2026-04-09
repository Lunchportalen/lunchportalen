# CP5 — Control tower context map

| Tårn | Primær rolle | Leser (kort) | Skriver (kort) | Påvirker | CMS-kobling |
|------|----------------|-------------|----------------|----------|-------------|
| Company admin | Drift eget selskap | Ordre/avtale/ansatte innafor `company_id` | `/api/admin/*` i scope | Ett selskap | Action surface + routing |
| Kitchen | Produksjon | Ordre per tenant/slot | Der API tillater | Dagens produksjon | Action surface |
| Driver | Levering | Stopplister | Leveranse-API | Utkjøring | Action surface |
| Superadmin | Plattform | System/firma/faktura | Superadmin-API | Hele systemet | Action surface + lenker |

**Prinsipp:** Tårn er **ikke** «separate produkter» i narrativet — de er **runtime-lag** med eksplisitt `actionRouting` i CMS-kortene.
