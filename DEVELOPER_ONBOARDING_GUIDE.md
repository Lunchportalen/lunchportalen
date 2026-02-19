# 👨‍💻 LUNCHPORTALEN – DEVELOPER ONBOARDING GUIDE

Velkommen til Lunchportalen.

Dette dokumentet er din inngang til systemet.

Lunchportalen er ikke en vanlig webapp.
Det er et deterministisk driftssystem med strenge arkitekturregler.

Les dette før du skriver én linje kode.

---

# 1️⃣ FØR DU STARTER

## 1.1 Installer

- Node >= 20.11
- npm
- Git
- Supabase CLI (valgfritt)
- Vercel CLI (valgfritt)

## 1.2 Installer avhengigheter

```bash
npm install
1.3 Start dev
npm run dev
RC-mode:

npm run dev:rc
2️⃣ PROSJEKTETS FILOSOFI
Lunchportalen er bygget på:

Database-first enforcement

Fail-closed prinsipp

Én sannhetskilde

No-exception rule

RPC-only writes

Multi-tenant isolasjon

Du må forstå dette før du endrer noe.

3️⃣ KRITISKE REGLER
3.1 Aldri skriv direkte til orders
Kun via:

lp_order_set

lp_order_cancel

Direkte:

supabase.from("orders").insert(...)
er forbudt i produksjonskode.

CI stopper deg.

3.2 Service-role er farlig
Service-role kan kun brukes i:

app/api/cron/**

app/api/superadmin/system/**

Aldri i order-ruter.

3.3 RLS er hellig
RLS håndhever:

Tenant-isolasjon

Rollebegrensning

Write-path kontroll

Ikke deaktiver.
Ikke bypass.
Ikke lag midlertidige unntak.

4️⃣ PROSJEKTSTRUKTUR (OVERSIKT)
/app/ → Next.js App Router

/app/api/ → API routes

/lib/ → Supabase, auth, guards

/supabase/ → SQL migrations

/scripts/ → CI og audits

/tests/ → Tenant og sikkerhetstester

Dokumentasjon → *.md

5️⃣ KODEENDRINGER
Før du lager feature:
Les:

SECURITY_ARCHITECTURE.md

CODEX_DATAWRITE.md

ARCHITECTURE_DECISIONS.md

Bestå Avensia-beslutningstesten:

Bryter dette determinisme?

Introduserer dette unntak?

Skaper dette admin-støy?

Hvis svaret er ja → stopp.

6️⃣ MERGE-KRAV
Før merge:

npm run preflight
Dette kjører:

ci:guard

typecheck

tester

tenant-isolation test

lint

audit

Ingen merge uten grønt.

7️⃣ FEILSØKING
Hvis noe feiler:

Ikke patch i produksjon

Ikke bypass RLS

Ikke hardkode override

Sjekk logs

Sjekk ops_events

Dokumenter

8️⃣ TYPISKE FEIL NYE UTVIKLERE GJØR
❌ Skriver direkte til DB
❌ Lager alternativ write-path
❌ Glemmer cut-off enforcement
❌ Introduserer feature-flag som omgår gates
❌ Endrer rollelogikk i frontend
❌ Ignorerer tenant-isolasjon

Dette skal ikke skje.

9️⃣ HVA DU SKAL FØLE
Du skal:

Føle at arkitekturen er streng

Føle at det er vanskelig å gjøre feil

Føle at systemet beskytter seg selv

Hvis det føles “for fleksibelt”, er noe galt.

🔟 HVORDAN TENKE
Når du lager noe nytt, spør:

Hvem kan skrive?

Hvem kan lese?

Hva skjer hvis noe feiler?

Hva skjer ved cut-off?

Hva skjer ved pause/close?

Hva skjer i multi-tenant?

Systemet skal alltid være forutsigbart.

1️⃣1️⃣ HVEM SPØR DU?
Ved tvil:

Spør teknisk ansvarlig

Les ADR

Ikke improviser

🏁 KONKLUSJON
Lunchportalen er ikke bygget for kreativ frihet.
Den er bygget for kontroll.

Din jobb er å forsterke arkitekturen – ikke svekke den.

Velkommen til teamet.