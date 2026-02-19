CODEX_CHECKLIST.md
# 🚦 LUNCHPORTALEN CODEX CHECKLIST
## GO / NO-GO før Merge, Deploy og Release

Dette dokumentet er en binær sjekkliste.

Hvis ett punkt feiler → er det NO-GO.

Ingen unntak.

---

# 1️⃣ DATABASE & RLS (ORDERS)

## 1.1 Orders skrivevei
- [ ] Ingen direkte `.insert()/.update()/.upsert()/.delete()` mot `orders` utenfor tests
- [ ] Alle writes skjer via `lp_order_set` / `lp_order_cancel`
- [ ] RPC er idempotente
- [ ] `UNIQUE(user_id, date)` er aktiv

## 1.2 Hard gates
- [ ] ACTIVE agreement kreves
- [ ] ACTIVE company kreves
- [ ] Cut-off 08:00 håndheves
- [ ] Tenant (company/location) valideres
- [ ] RLS er aktiv på `orders`

---

# 2️⃣ SERVICE ROLE HYGIENE

## 2.1 Tillatt bruk
- [ ] Service role brukes kun i:
  - `app/api/cron/**`
  - `app/api/superadmin/system/**`
  - migrations / workflows

## 2.2 Forbud
- [ ] Ingen service-role i `app/api/order/**`
- [ ] Ingen service-role i `app/api/orders/**`
- [ ] Ingen service-role i `app/api/kitchen/**` uten scope-RPC
- [ ] Ingen service-role i client kode

## 2.3 CI-Guard
- [ ] `ci:guard` passerer
- [ ] Ingen nye brudd i grep-regler

---

# 3️⃣ AGREEMENTS & COMPANY STATUS

## 3.1 Avtale
- [ ] Maks 1 ACTIVE agreement per (company_id, location_id)
- [ ] Activate/pause/resume/close skjer via server-RPC
- [ ] Alle endringer logges i `ops_events`

## 3.2 Company status
- [ ] Company kan ikke være ACTIVE uten aktiv avtale
- [ ] Statusendringer logges

---

# 4️⃣ KJØKKEN & DRIVER

## 4.1 Scope
- [ ] Kjøkken har definert scope
- [ ] Driver har definert scope
- [ ] Ingen global lesing uten eksplisitt beslutning

## 4.2 Endringer
- [ ] Kjøkken kan ikke endre orders direkte
- [ ] Eventuelle bulk-operasjoner bruker dedikert RPC

---

# 5️⃣ LOGGING & SPORBARHET

## 5.1 Ops-events
- [ ] Alle kritiske mutations skriver til `ops_events`
- [ ] Inneholder:
  - actor_user_id
  - company_id
  - rid
  - payload

## 5.2 Feilkoder
- [ ] RPC returnerer strukturert feil
- [ ] Ingen "silent ok"

---

# 6️⃣ CRON & SYSTEM

## 6.1 Cron
- [ ] Cron kjører med service-role
- [ ] Cron kan ikke omgå forretningsregler
- [ ] Cleanup (rate/idempotency/ops) er aktiv

## 6.2 System-motor
- [ ] SYSTEM_MOTOR_SECRET kreves
- [ ] Secrets verifiseres i CI

---

# 7️⃣ TENANT ISOLATION

## 7.1 Multi-tenant lås
- [ ] Composite FK (company_id, location_id)
- [ ] Ingen cross-tenant lesing i RLS
- [ ] `test:tenant` passerer

---

# 8️⃣ RELEASE HARDENING

Før merge til `main`:

- [ ] `npm run ci:guard`
- [ ] `npm run typecheck`
- [ ] `npm run test:run`
- [ ] `npm run test:tenant`
- [ ] `npm run build:enterprise`
- [ ] Ingen console warnings relatert til auth/supabase

---

# 9️⃣ NO-EXCEPTION RULE

- [ ] Ingen midlertidige bypass
- [ ] Ingen debug-RPC igjen i repo
- [ ] Ingen feature-flag som omgår gates

---

# 🔟 FINAL DECISION

Hvis ALLE punkter er:

✅ = GO  
❌ = NO-GO  

Ingen "vi fikser etter deploy".

---

# 🧾 SIGN-OFF

Release vurdert av:

- [ ] Teknisk ansvarlig
- [ ] Database-ansvarlig
- [ ] Drift/ops-ansvarlig