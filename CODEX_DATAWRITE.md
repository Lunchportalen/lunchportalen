# Ã°Å¸â€ºÂ¡ LUNCHPORTALEN CODEX
## Datawrite, Service-Role og Kritisk Forretningslogikk

Dette dokumentet er en bindende teknisk kontrakt for hvordan data kan skrives i Lunchportalen.

FormÃƒÂ¥let er ÃƒÂ¥ sikre:

- Ãƒâ€°n sannhetskilde
- Ingen manuelle unntak
- Fail-closed atferd
- Determinisme
- Sporbarhet
- Ingen skjulte bakdÃƒÂ¸rer

Dette dokumentet gjelder hele repoet.

---

# 1Ã¯Â¸ÂÃ¢Æ’Â£ GRUNNPRINSIPP

> Ingen direkte writes til kritiske tabeller uten eksplisitt godkjent RPC og rolle-/scope-validering.

Kritiske tabeller inkluderer:

- `orders`
- `agreements`
- `companies`
- `profiles`
- Alle tabeller som pÃƒÂ¥virker produksjon, levering eller ÃƒÂ¸konomi

---

# 2Ã¯Â¸ÂÃ¢Æ’Â£ ORDERS Ã¢â‚¬â€œ ABSOLUTT REGEL

## 2.1 Tillatt skrivevei

FÃƒÂ¸lgende RPC-er er eneste tillatte mÃƒÂ¥te ÃƒÂ¥ endre bestillinger:

- `lp_order_set`
- `lp_order_cancel`

Disse hÃƒÂ¥ndhever:

- Cut-off 08:00 (Europe/Oslo)
- ACTIVE agreement
- ACTIVE company
- Rollevalidering
- Tenant-lÃƒÂ¥s (company/location)
- Idempotens (UNIQUE user_id + date)

---

## 2.2 Strengt forbudt

FÃƒÂ¸lgende er ikke tillatt i produksjonskode:

```ts
supabase.from("orders").<write>(...)
supabase.from("orders").<write>(...)
supabase.from("orders").<write>(...)
supabase.from("orders").<write>(...)
Unntak:

tests/**

supabase/migrations/**

3Ã¯Â¸ÂÃ¢Æ’Â£ SERVICE ROLE POLICY
3.1 Tillatt bruk av SUPABASE_SERVICE_ROLE_KEY

Kun i:

app/api/cron/**

app/api/superadmin/system/**

supabase/migrations/**

.github/workflows/**

interne scripts (ikke eksponert API)

3.2 Strengt forbudt

Service role kan aldri brukes i:

app/api/order/**

app/api/orders/**

app/api/kitchen/** (uten scope-gate)

app/api/driver/**

klientkode

4Ã¯Â¸ÂÃ¢Æ’Â£ ADMIN & SUPERADMIN

Administrative endringer (agreements, company status, etc.) mÃƒÂ¥:

skje via server-RPC

validere rolle (superadmin)

validere scope

logges i ops_events

vÃƒÂ¦re deterministiske

Direkte .update() via service role uten RPC er ikke tillatt.

5Ã¯Â¸ÂÃ¢Æ’Â£ KJÃƒËœKKEN & DRIVER

KjÃƒÂ¸kken og driver:

kan kun lese innenfor definert scope

kan ikke skrive direkte til orders

kan kun gjÃƒÂ¸re endringer via dedikert RPC med scope-validering

6Ã¯Â¸ÂÃ¢Æ’Â£ LOGGING & SPORBARHET

Alle kritiske endringer mÃƒÂ¥:

logges til ops_events

inneholde rid

inneholde actor_user_id

inneholde company_id

inneholde payload

Ingen skjulte system-endringer er tillatt.

7Ã¯Â¸ÂÃ¢Æ’Â£ FEILKODER & KONTRAKT

Alle RPC-er mÃƒÂ¥ returnere strukturert respons:

{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "rid": "uuid",
  "timestamp": "ISO-8601"
}


Ingen stille feil.
Ingen "implicit ok".

8Ã¯Â¸ÂÃ¢Æ’Â£ CI-GATE (AUTOMATISK HÃƒâ€¦NDHEVING)

Repoet inneholder en CI-guard som stopper:

Service role utenfor allowlist

Direkte writes til orders

Nye bakdÃƒÂ¸rer

Build skal feile ved brudd.

9Ã¯Â¸ÂÃ¢Æ’Â£ NO-EXCEPTION RULE

Lunchportalen fÃƒÂ¸lger:

Ingen individuelle unntak

Ingen manuelle overstyringer

Ingen midlertidige bypass

Ingen Ã¢â‚¬Å“bare denne ene gangenÃ¢â‚¬Â

Systemet er ÃƒÂ©n sannhetskilde.

Ã°Å¸â€Å¸ VEDLIKEHOLD

Enhver ny API-rute som:

skriver til kritiske tabeller

bruker service role

pÃƒÂ¥virker avtaler/bestillinger

mÃƒÂ¥:

Dokumenteres her

Vurderes mot AGENTS.md

BestÃƒÂ¥ CI-guard

Ã°Å¸Â§Â¾ SLUTTORD

Dette dokumentet eksisterer for ÃƒÂ¥ sikre at:

Lunchportalen er enterprise-grade

Systemet ikke fÃƒÂ¥r teknisk gjeld som undergraver modellen

Ingen fremtidig utvikler kan utilsiktet ÃƒÂ¥pne en bakdÃƒÂ¸r

Hvis noe bryter denne Codexen, skal det anses som feil Ã¢â‚¬â€ ikke som et valg.
