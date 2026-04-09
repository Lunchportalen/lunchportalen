# Security hardening plan (uten stor auth-refaktor)

**Mål:** Lukke **reelle** hull før pilot/live uten å bryte frosne flyter (jfr. AGENTS.md) og uten «big bang»-omskriving av auth.

---

## 1. Verifisert tilstand (fra baseline + revisjon)

- **Middleware:** sjekker at `sb-access-token` finnes på beskyttede stier — **ikke** rolle (**STILL OPEN** risiko).
- **Server:** `getAuthContext`, `scopeOr401`, `requireRoleOr403`, layout-guards — **primær** forsvarslinje.
- **Post-login:** `allowNextForRole` begrenser `next` per rolle; employee nå **kun `/week`** (re-verifisert).

---

## 2. Hva som bør lukkes før live (prioritert)

| Prioritet | Tiltak | Bevis |
|-----------|--------|--------|
| P0 | **Stikkprøve-audit:** liste over API-ruter som håndterer sensitiv data uten `scopeOr401` | Sjekkliste + eventuelle rettelser i egne PR-er |
| P0 | **Cron og worker:** alle muterende interne kall krever hemmelighet | Miljøsjekk + failed test hvis mangler |
| P1 | **Headers:** `noStore` der relevant for autentiserte API | Konsistens med eksisterende mønster |
| P1 | **Rate limiting** på dyre offentlige eller AI-endepunkter | Eksisterende `checkAiRateLimit` mønster utvides der hull finnes |
| P2 | **Gradvis `strict: true`** eller `strict`-delsett i nye moduler | Langsiktig; ikke blokkér pilot alene |

---

## 3. Bevisst ikke i denne planen

- Full omskriving av middleware til rollebevissthet (høy regressjonsrisiko).  
- Endring av onboarding/telefon/frys uten eksplisitt eierskap.

---

## 4. Anbefalt rekkefølge

1. Automatisert **route inventory** mot `scopeOr401`-mønster (script finnes delvis i repo — vurder utvidelse).  
2. Manuell review av **`/api/admin/*`**, **`/api/superadmin/*`**, **`/api/backoffice/*`** — høyeste ROI.  
3. **Pen-test** eller intern sikkerhetsreview av session fixation / CSRF der cookies brukes — **NEEDS RE-VERIFICATION**.

---

## 5. «Ferdig»-kriterium

- Ingen kjente **P0**-hull i rute-gates for pilot-tenant scope.  
- Cron secrets **ikke** tomme i prod.  
- Dokumentert **incident response** (minst én side) koblet til logging.
