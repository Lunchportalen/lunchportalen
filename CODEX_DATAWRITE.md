# 🛡 LUNCHPORTALEN CODEX
## Datawrite, Service-Role og Kritisk Forretningslogikk

Dette dokumentet er en bindende teknisk kontrakt for hvordan data kan skrives i Lunchportalen.

Formålet er å sikre:

- Én sannhetskilde
- Ingen manuelle unntak
- Fail-closed atferd
- Determinisme
- Sporbarhet
- Ingen skjulte bakdører

Dette dokumentet gjelder hele repoet.

---

# 1️⃣ GRUNNPRINSIPP

> Ingen direkte writes til kritiske tabeller uten eksplisitt godkjent RPC og rolle-/scope-validering.

Kritiske tabeller inkluderer:

- `orders`
- `agreements`
- `companies`
- `profiles`
- Alle tabeller som påvirker produksjon, levering eller økonomi

---

# 2️⃣ ORDERS – ABSOLUTT REGEL

## 2.1 Tillatt skrivevei

Følgende RPC-er er eneste tillatte måte å endre bestillinger:

- `lp_order_set`
- `lp_order_cancel`

Disse håndhever:

- Cut-off 08:00 (Europe/Oslo)
- ACTIVE agreement
- ACTIVE company
- Rollevalidering
- Tenant-lås (company/location)
- Idempotens (UNIQUE user_id + date)

---

## 2.2 Strengt forbudt

Følgende er ikke tillatt i produksjonskode:

```ts
supabase.from("orders").insert(...)
supabase.from("orders").update(...)
supabase.from("orders").upsert(...)
supabase.from("orders").delete(...)
Unntak:

tests/**

supabase/migrations/**

3️⃣ SERVICE ROLE POLICY
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

4️⃣ ADMIN & SUPERADMIN

Administrative endringer (agreements, company status, etc.) må:

skje via server-RPC

validere rolle (superadmin)

validere scope

logges i ops_events

være deterministiske

Direkte .update() via service role uten RPC er ikke tillatt.

5️⃣ KJØKKEN & DRIVER

Kjøkken og driver:

kan kun lese innenfor definert scope

kan ikke skrive direkte til orders

kan kun gjøre endringer via dedikert RPC med scope-validering

6️⃣ LOGGING & SPORBARHET

Alle kritiske endringer må:

logges til ops_events

inneholde rid

inneholde actor_user_id

inneholde company_id

inneholde payload

Ingen skjulte system-endringer er tillatt.

7️⃣ FEILKODER & KONTRAKT

Alle RPC-er må returnere strukturert respons:

{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "rid": "uuid",
  "timestamp": "ISO-8601"
}


Ingen stille feil.
Ingen "implicit ok".

8️⃣ CI-GATE (AUTOMATISK HÅNDHEVING)

Repoet inneholder en CI-guard som stopper:

Service role utenfor allowlist

Direkte writes til orders

Nye bakdører

Build skal feile ved brudd.

9️⃣ NO-EXCEPTION RULE

Lunchportalen følger:

Ingen individuelle unntak

Ingen manuelle overstyringer

Ingen midlertidige bypass

Ingen “bare denne ene gangen”

Systemet er én sannhetskilde.

🔟 VEDLIKEHOLD

Enhver ny API-rute som:

skriver til kritiske tabeller

bruker service role

påvirker avtaler/bestillinger

må:

Dokumenteres her

Vurderes mot AGENTS.md

Bestå CI-guard

🧾 SLUTTORD

Dette dokumentet eksisterer for å sikre at:

Lunchportalen er enterprise-grade

Systemet ikke får teknisk gjeld som undergraver modellen

Ingen fremtidig utvikler kan utilsiktet åpne en bakdør

Hvis noe bryter denne Codexen, skal det anses som feil — ikke som et valg.