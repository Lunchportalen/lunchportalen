# Tripletex Onboarding Strategy

**Dokumentversjon:** 1.0
**Dato:** 2026-05-21
**Status:** Aktivt design — pre-implementation
**Forfatter:** Teknisk arkitektur
**Plan-referanse:** TRIPLETEX-PLAN-V1 v3.13
**Patcher dette dokumentet spesifiserer:** TPT-B-7a, TPT-B-7b, TPT-B-7c
**Avhengigheter:** TPT-B-1 til TPT-B-6 + TPT-B-5b (alle ✅ pushed)

---

## 1. Executive Summary

### 1.1 Mål

Levere enterprise-grade Tripletex-onboarding for provider-administratorer som er **enkel å forstå, enkel å bruke, og som ikke tar snarveier på sikkerhet eller validering**. Operatøren skal kunne koble sin egen Tripletex-konto til Lunchportalen og være klar til å fakturere innen 3-5 minutter, uten å kontakte support, og med tydelig tilbakemelding gjennom hele prosessen.

### 1.2 Strategisk kontekst

**Accounting adapter-modell (fremtidig):** Tripletex er en **norsk regnskapsadapter**, ikke global billing-sannhet. Core billing/settlement-data i Lunchportalen forblir nøytral; providere velger regnskapsintegrasjon per marked. Andre land kan senere få egne adapters (Fiken, Fortnox, e-conomic, osv.). Denne PR/arkitektur-notatet dokumenterer retningen — ingen adapter-runtime implementeres her.

Tripletex tilbyr to onboarding-modeller for tredjeparts-integrasjoner:

1. **Integration Marketplace** — provider initierer "Aktivér" inne i Tripletex, Tripletex POSTer tokens til vår redirect-URL. Krever Tripletex Partner-godkjenning, som igjen krever eksisterende produksjonskunder. Ikke tilgjengelig for oss før 3-5 fornøyde providere er onboarded.

2. **Direct connection** — provider initierer fra Lp's UI, genererer Employee Token manuelt i sin Tripletex, og limer det inn. Standard mønster for nesten alle Tripletex-integrasjoner i markedet (Svenn, Gripr, Tribe, RecMan, Morescope).

Lunchportalen implementerer **begge spor parallelt**:

- **Direct connection (TPT-B-7b)** — primær onboarding-vei nå og fremover. Bygges med enterprise-grade wizard, ikke 2-felts skjema.
- **Marketplace redirect (TPT-B-7a)** — bygges som klar mottaker fra dag 1, slik at vi er marketplace-ready når Tripletex godkjenner søknaden (forventet etter første 3-5 produksjonskunder).
- **Connection health dashboard (TPT-B-7c)** — observability for provider-admins, identisk uavhengig av hvilken vei de kom inn.

### 1.3 Hva som er teknisk forutsetning

Backend-pipelinen er **komplett**:

| Patch | Funksjon | Status |
|---|---|---|
| TPT-B-1 | Vault-storage for provider credentials | ✅ |
| TPT-B-2 | Customer/product/VAT-library mot provider's Tripletex | ✅ |
| TPT-B-3 | Agreement invoice generation | ✅ |
| TPT-B-4 | Invoice worker (push til Tripletex) | ✅ |
| TPT-B-5 | Cron + billing-window scheduler | ✅ |
| TPT-B-5b | Agreement lifecycle hooks | ✅ |
| TPT-B-6 | Webhook for paid-status sync | ✅ |

Det eneste som mangler for full produksjon er onboarding-UX. Dette dokumentet definerer det.

### 1.4 Suksesskriterier

Et provider-admin skal:
1. Forstå om kontoen deres er kompatibel før de prøver (ingen "prøv og feil")
2. Generere Employee Token i Tripletex med visuell veiledning, ikke skriftlige instruksjoner
3. Få umiddelbar tilbakemelding ved feil tilgang eller mistype
4. Se status-badge på siden som speiler reell connection-helse
5. Kunne rotere webhook-secret, koble fra, og koble til igjen uten support
6. Ha audit-trail for alle credential-endringer

---

## 2. Designprinsipper

### 2.1 Hardregler (brytes aldri)

Følger samme hardregler som resten av Lp-systemet (jf. `userPreferences`):

- **Operasjonell data → Supabase.** Provider credentials, connection state, audit-log. Aldri annet sted.
- **Markedsinnhold → Umbraco.** Onboarding-instruksjoner som ligger på lunchportalen.no skal være i Umbraco. Wizard-state og logikk er Next.js.
- **Applikasjonslogikk → Next.js.** All form-validering, state-machine, RPC-kall.
- **Designsystem.** Bruk `ds-*` og `lp-*` klasser. Ingen inline-styles. Ingen ad-hoc CSS.
- **Mobile-first.** Wizard må fungere på mobil; provider-admin er ofte ute av kontor når de gjør onboarding.
- **WCAG AA.** Inkludert `prefers-reduced-motion` og `:focus-visible`. Min 48px touch-target.
- **Deterministisk.** Ingen "fungerer som regel"-løsninger. Hver feilsti har en designet recovery-path.

### 2.2 Onboarding-spesifikke prinsipper

**Verify everything, trust nothing.**
Selv etter HMAC, etter `whoAmI`, etter `company`-match: kjør en lese-test mot `/v2/product` for å verifisere at tokenet faktisk har de rettighetene vi trenger. Defense in depth.

**Show, don't tell.**
Tripletex' UI for token-generering har 4-5 steg som er vanskelig å beskrive i tekst. Wizard skal vise korte videoer (eller animerte GIF-er) som demonstrerer hvert steg, ikke bare beskrive dem.

**Fail loud, recover gracefully.**
Hver feilsituasjon skal ha en designet feilmelding med klar neste-handling. "Noe gikk galt" er forbudt. Faktiske feilmeldinger: "Token er gyldig, men mangler rettighet til /v2/product. Gå tilbake til Tripletex og velg 'Alle tilganger' når du genererer nytt nøkkel."

**One-time secrets shown once.**
Webhook-secret genereres serverside, vises én gang i UI med copy-button, og kan ikke vises igjen. Provider må selv kopiere til Tripletex. Industri-standard (Stripe, GitHub, AWS).

**Soft-disconnect, not hard-delete.**
Når provider kobler fra, markeres credentials som inaktive (ikke slettet) med 30 dagers grace. Etter 30 dager: vault-purge. Audit-historikk beholdes for alltid. Tillater rollback hvis frakobling var feil.

### 2.3 Konflikt-prioriteringer

Når prinsipper kolliderer, prioriteres i denne rekkefølgen:

1. Sikkerhet (secret-håndtering, role-gating, HMAC, audit)
2. Operasjonell klarhet (provider forstår tilstand til enhver tid)
3. Enterprise-pålitelighet (deterministisk feil-håndtering, retries, graceful degradation)
4. Mobile-first utførelse
5. Lavfriksjons brukerflyt
6. Skalerbarhet og vedlikeholdbarhet

---

## 3. Connection Lifecycle State Machine

### 3.1 Stater

| State | Betydning | UI-badge | Provider kan |
|---|---|---|---|
| `NOT_CONNECTED` | Ingen Tripletex-credentials lagret for denne provider+env | "Ikke tilkoblet" (grå) | Starte wizard |
| `CONFIGURING` | Wizard pågår, tokens validert men auto-provisioning kjører | "Konfigurerer..." (gul, pulse-animasjon) | Vente, eller avbryte |
| `CONNECTED` | Tokens validert, products/VAT/customer-mappinger klare, webhook registrert | "Tilkoblet" (grønn) | Rotere secret, koble fra, se health |
| `DEGRADED` | Tokens fortsatt valide men noe er galt (eks: siste 3 invoice-pushes failet, webhook-events stoppet i 7 dager, token-utløp innen 14 dager) | "Trenger oppmerksomhet" (gul) | Se feil-detaljer, reconfigure |
| `DISCONNECTED` | Bevisst frakoblet, i 30-dagers grace | "Frakoblet — slettes om N dager" (rød) | Reconnect (uten ny token), endelig slett |

### 3.2 Transisjoner

```
NOT_CONNECTED ──[start wizard, validate tokens]──→ CONFIGURING
NOT_CONNECTED ←──[grace expired, vault purged]── DISCONNECTED

CONFIGURING ──[auto-provisioning success + webhook registered]──→ CONNECTED
CONFIGURING ──[any validation fail, wizard exit]──→ NOT_CONNECTED

CONNECTED ──[N consecutive worker failures OR webhook silence OR token expiry warning]──→ DEGRADED
CONNECTED ──[provider clicks "Koble fra"]──→ DISCONNECTED

DEGRADED ──[provider runs Reconfigure wizard, all checks pass]──→ CONNECTED
DEGRADED ──[provider clicks "Koble fra"]──→ DISCONNECTED

DISCONNECTED ──[provider clicks "Koble til igjen" innen 30d]──→ CONFIGURING
DISCONNECTED ──[automatic, 30d grace expired]──→ NOT_CONNECTED (vault purged)
```

### 3.3 Persistert state

State lagres i `provider_tripletex_connections` (utvidelse av eksisterende `provider_tripletex_credentials` fra B-1):

```sql
ALTER TABLE provider_tripletex_credentials ADD COLUMN
  connection_state text NOT NULL DEFAULT 'NOT_CONNECTED'
  CHECK (connection_state IN
    ('NOT_CONNECTED','CONFIGURING','CONNECTED','DEGRADED','DISCONNECTED'));

ALTER TABLE provider_tripletex_credentials ADD COLUMN
  state_changed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE provider_tripletex_credentials ADD COLUMN
  disconnected_at timestamptz NULL;  -- når DISCONNECTED, tikker 30d

ALTER TABLE provider_tripletex_credentials ADD COLUMN
  vault_purge_at timestamptz NULL;   -- disconnected_at + 30d

ALTER TABLE provider_tripletex_credentials ADD COLUMN
  health_check_at timestamptz NULL;  -- siste vellykket /v2/whoAmI
```

Alle state-endringer logges i `lp_audit_log` med `event_type='tripletex_connection_state_change'`.

### 3.4 Health-check schedule

Cron `/api/cron/tripletex-connection-health-daily` (ny, B-7c):

- Kjører daglig 05:00 UTC (før billing-cron på 06:00)
- For hver `CONNECTED` provider:
  - `GET /v2/whoAmI` mot deres Tripletex
  - Hvis success: oppdaterer `health_check_at`
  - Hvis 401/403: transition til `DEGRADED`, log + notify provider_admin
  - Hvis 5xx: ignore (transient), neste run prøver igjen
- For hver `DEGRADED`:
  - Re-kjør samme sjekk; hvis nå success, transition tilbake til `CONNECTED`
- For hver `DISCONNECTED`:
  - Hvis `vault_purge_at <= now()`: purge tokens + secret, transition til `NOT_CONNECTED`

---

## 4. User Flows

### 4.1 Direct Wizard (TPT-B-7b — primær)

Provider-admin navigerer til `/leverandor/innstillinger/regnskap`.

#### Steg 0 — Preflight

**Hva skjer:**
- Lp sjekker `connection_state` for innlogget provider + env-toggle (test/prod)
- Hvis `NOT_CONNECTED` eller `DISCONNECTED`: viser "Koble til Tripletex"-call-to-action
- Hvis `CONNECTED`/`DEGRADED`: viser dashboard (4.3)
- Hvis `CONFIGURING`: gjenoppta wizard på lagret steg

**Komplett-pakke-sjekk:**
Når provider klikker "Kom i gang", før noe annet vises:

```
┌─────────────────────────────────────────────────────────┐
│ Før vi kobler til Tripletex                             │
│                                                         │
│ Tripletex' API-integrasjon krever Smart- eller          │
│ Komplett-pakken. Lunchportalen kan ikke verifisere      │
│ dette automatisk — du må bekrefte selv.                 │
│                                                         │
│ Slik sjekker du i Tripletex:                            │
│   1. Logg inn på tripletex.no                           │
│   2. Klikk Selskap → Mitt abonnement                    │
│   3. Bekreft at det står "Smart" eller "Komplett"       │
│                                                         │
│ [ Åpne Tripletex i ny fane ]                            │
│                                                         │
│ [ ✓ ] Jeg har bekreftet at vi har Smart eller Komplett │
│                                                         │
│ [ Tilbake ]              [ Fortsett →  (disabled inntil │
│                                          checkbox)     ]│
└─────────────────────────────────────────────────────────┘
```

Provider-admin må eksplisitt huke av før de kan fortsette. Dette er produktbeslutning #1: ingen automatisk sjekk, eksplisitt bekreftelse forhindrer support-tickets.

#### Steg 1 — Generér Employee Token

**Hva skjer:**
- Lp viser en compact instruks-panel med innebygd video (max 60 sek) eller animert GIF
- En "Åpne Tripletex"-knapp deep-linker til API-tilgang-siden:
  `https://tripletex.no/execute/employeeMenu?contextId={tripletex_company_id_input}`
- Provider får guide-tekst:

```
┌─────────────────────────────────────────────────────────┐
│ Steg 1 av 4: Generér Employee Token i Tripletex         │
│                                                         │
│ ┌─────────────────────┐                                 │
│ │ [ Video 45 sek ] ▶  │   1. Klikk Selskap → Selskap-   │
│ │ Slik genererer du   │      innstillinger → API-       │
│ │ et token            │      tilgang                    │
│ └─────────────────────┘   2. Klikk "Ny nøkkel"          │
│                           3. Integrasjonsnavn:          │
│                              "Lunchportalen"            │
│                           4. Tilganger: "Alle"          │
│                           5. Kopier tokenet (vises kun  │
│                              denne ene gangen!)         │
│                                                         │
│ Tripletex Company ID (fra URL-en i din Tripletex):      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 114612665                                            │ │
│ └─────────────────────────────────────────────────────┘ │
│   Format: 9 sifre. Finn det i URL-en: contextId=...     │
│                                                         │
│ [ Åpne min Tripletex i ny fane ]                        │
│                                                         │
│ [ ← Tilbake ]                            [ Fortsett →  ]│
└─────────────────────────────────────────────────────────┘
```

Validering on-the-fly: company_id må være numerisk, 6-12 siffer. Vises rød ramme + hint hvis ikke.

#### Steg 2 — Lim inn token + verifiser

**Hva skjer:**
- Provider limer inn Employee Token i et secure-input felt (type="password")
- Når provider klikker "Verifiser og koble til": Lp kjører tre-trinns verifisering (produktbeslutning #3):

```
[1/3] Tester autentisering...
      → GET /v2/whoAmI mot provider's Tripletex
      ✓ Token er gyldig (eller × Token avvist av Tripletex)

[2/3] Verifiserer Company ID-match...
      → Sammenligner whoAmI.companyId med inputted company_id
      ✓ Match (eller × Mismatch — token tilhører en annen konto)

[3/3] Tester rettigheter...
      → GET /v2/product?count=1 mot provider's Tripletex
      ✓ Tilstrekkelige rettigheter (eller × Token mangler product-access)
```

Hver av disse er en separat RPC-kall til Lp's backend, som proxier til Tripletex. Lp lagrer ikke tokenet før alle tre er green.

UI under verifisering:

```
┌─────────────────────────────────────────────────────────┐
│ Steg 2 av 4: Lim inn og verifiser                       │
│                                                         │
│ Employee Token                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●         │ │
│ └─────────────────────────────────────────────────────┘ │
│   Tokenet vises ikke etter at det er lagret             │
│                                                         │
│ [ Verifiser og koble til ]                              │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ ⟳ Tester autentisering...           ●○○                 │
│ ⟳ Verifiserer Company ID-match...   ○○○                 │
│ ⟳ Tester rettigheter...             ○○○                 │
└─────────────────────────────────────────────────────────┘
```

Etter alle tre passerer:

```
✓ Autentisering OK
✓ Company ID-match OK
✓ Rettigheter OK

Klar til neste steg: vi setter opp produktkatalog og MVA-koder.
[ Fortsett →  ]
```

#### Steg 3 — Auto-provisioning

**Hva skjer:**
- Lp kjører i bakgrunn:
  - `ensureProviderVatCode` for 25 %, 15 %, 0 % (3 stk)
  - `ensureProviderProduct` for BASIS, LUXUS, ENTERPRISE (3 stk)
  - Bulk `ensureCompanyCustomer` for alle eksisterende `ACTIVE` agreements på denne provideren (N stk avhengig av provider-størrelse)
- Progress-bar med eksplisitte teller: "Synkroniserer 12 av 28 kunder..."
- Tar typisk 10-60 sekunder

```
┌─────────────────────────────────────────────────────────┐
│ Steg 3 av 4: Setter opp Tripletex-katalogen for deg     │
│                                                         │
│ ████████████████░░░░░░░░  64%                           │
│                                                         │
│ ✓ MVA-koder lagt til (25 %, 15 %, 0 %)                  │
│ ✓ Produkter opprettet (BASIS, LUXUS, ENTERPRISE)        │
│ ⟳ Synkroniserer kunder... 12 av 28                      │
│                                                         │
│ Du trenger ikke vente — vi fortsetter i bakgrunnen      │
│ hvis du lukker fanen.                                   │
│                                                         │
│ [ Lukk og fortsett senere ]    [ Fortsett →  (når 100%)]│
└─────────────────────────────────────────────────────────┘
```

Hvis noen av disse feiler (eks: én company mangler `org_number`): logges og listes i en "trenger oppmerksomhet"-seksjon på dashboard, men blokkerer ikke fullføring av onboarding.

#### Steg 4 — Webhook-secret + registrering

**Hva skjer:**
- Lp genererer webhook-secret server-side via `lp_provider_rotate_webhook_secret` (B-6)
- Viser secret én gang i UI med copy-button
- Viser webhook-URL provider må kopiere inn i Tripletex
- Viser instrukser (med video) for å registrere webhook i Tripletex

```
┌─────────────────────────────────────────────────────────┐
│ Steg 4 av 4: Registrér webhook i Tripletex              │
│                                                         │
│ For at vi automatisk skal vite når en faktura er        │
│ betalt, må Tripletex sende oss et webhook-kall.         │
│                                                         │
│ Webhook-URL (kopier til Tripletex):                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ https://app.lunchportalen.no/api/webhooks/          │ │
│ │   tripletex-provider/abc-123-def?env=prod          │ │
│ └─────────────────────────────────────────────────────┘ │
│ [ 📋 Kopier ]                                           │
│                                                         │
│ Webhook-secret (vis kun denne ene gangen):              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ tpt_whsec_aBc123XyZ_____________Lagre nå!          │ │
│ └─────────────────────────────────────────────────────┘ │
│ [ 📋 Kopier ]                                           │
│                                                         │
│ ⚠️  Denne secret vises ikke igjen. Lagre den i din     │
│    Tripletex-konfigurasjon NÅ. Hvis du mister den,      │
│    må du rotere en ny.                                  │
│                                                         │
│ ┌─────────────────────┐  Slik registrerer du i          │
│ │ [ Video 30 sek ] ▶  │  Tripletex:                     │
│ │ Slik registrerer    │   1. Innstillinger → Webhooks   │
│ │ du webhook          │   2. "Ny webhook"               │
│ └─────────────────────┘   3. Event: closegroup.create   │
│                           4. URL: lim inn ovenfor       │
│                           5. Secret: lim inn ovenfor    │
│                                                         │
│ [ ✓ ] Jeg har registrert webhook i Tripletex            │
│                                                         │
│ [ Fullfør ]  (disabled inntil checkbox)                 │
└─────────────────────────────────────────────────────────┘
```

**Note:** Hybrid-modell (produktbeslutning #2): Hvis Tripletex' API tillater programmatisk webhook-registrering (sjekkes i B-9 før B-7 koding starter), erstatter Lp dette steget med automatisk registrering, og bare viser "✓ Webhook registrert automatisk". Manuell vei er fallback.

#### Ferdig

```
┌─────────────────────────────────────────────────────────┐
│ ✓ Tripletex er koblet til Lunchportalen                 │
│                                                         │
│ Du kan nå:                                              │
│   • Sende fakturaer automatisk til provider's Tripletex │
│   • Motta paid-status-oppdateringer via webhook         │
│   • Se faktura-historikk og connection-helse på         │
│     /leverandor/innstillinger/regnskap                  │
│                                                         │
│ Vi sender en test-faktura til Tripletex nå for å        │
│ bekrefte at alt fungerer ende-til-ende. (Du kan        │
│ slette den i Tripletex etterpå.)                        │
│                                                         │
│ [ Gå til dashboard ]    [ Send test-faktura ]           │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Marketplace Redirect (TPT-B-7a — fremtidig primær)

**Hva skjer:**
- Provider er logget inn i sin Tripletex
- Går til "Integrasjoner" i Tripletex' meny
- Finner "Lunchportalen" i marketplace, klikker "Aktivér"
- Tripletex POSTer `application/x-www-form-urlencoded` til vår redirect-endpoint:
  - `companyId` (Tripletex Company ID)
  - `companyName`
  - `orgNumber`
  - `token` (Employee Token, auto-generert)
- Vår endpoint `/api/integrations/tripletex/install` håndterer:
  1. Match `orgNumber` mot eksisterende provider i Lp (via `companies.org_number` join til `providers`)
  2. Hvis match: legg signed JWT i URL og redirect til `/leverandor/innstillinger/regnskap/tripletex-callback`
  3. Hvis ingen match: redirect til `/sign-up?prefill=tripletex&companyName=...&orgNumber=...`

**Callback-page:** Tar imot JWT, validerer (5-min utløp, single-use), kjører Steg 3 og Steg 4 fra Direct wizard (auto-provisioning + webhook). Steg 1 og Steg 2 hoppes over fordi Tripletex har allerede gitt oss token og verifisert deres egen company_id.

**Sluttstate:** identisk med Direct wizard.

### 4.3 Connection Dashboard (TPT-B-7c)

For provider-admin når `connection_state IN ('CONNECTED', 'DEGRADED', 'DISCONNECTED')`:

```
┌─────────────────────────────────────────────────────────┐
│ Tripletex-tilkobling                          [PROD ▼]  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ● Tilkoblet                          (siden 21. mai)│ │
│ │ Selskap: Provider Catering AS (114612665)           │ │
│ │ Siste helse-sjekk: i dag kl 05:00 ✓                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Aktivitet siste 30 dager                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Fakturaer sendt:        47                          │ │
│ │ Fakturaer markert betalt: 32                        │ │
│ │ Failed pushes:          0                           │ │
│ │ Webhook-events mottatt: 32                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Nylige hendelser                          [Se alle →]   │
│ • 21.05 14:23  Invoice #2026-0047 → SENT ✓              │
│ • 21.05 09:11  Webhook: closegroup.create → PAID ✓      │
│ • 20.05 22:00  Daily cron: 3 invoices generated         │
│ • 20.05 14:23  Invoice #2026-0046 → SENT ✓              │
│                                                         │
│ Avansert                                                │
│ [ Roter webhook-secret ]  [ Send test-faktura ]         │
│ [ Koble fra Tripletex (soft-delete med 30d grace) ]     │
└─────────────────────────────────────────────────────────┘
```

#### DEGRADED-tilstand

Når `connection_state = 'DEGRADED'`, dashboard-headerseksjonen byttes:

```
┌─────────────────────────────────────────────────────┐
│ ⚠ Trenger oppmerksomhet                             │
│                                                     │
│ Tripletex-tilkoblingen virker delvis, men vi har    │
│ oppdaget problemer:                                 │
│                                                     │
│ • 3 av siste 5 invoice-pushes feilet (token-401)    │
│ • Siste vellykkede helse-sjekk: 19.05 (2 dager)     │
│                                                     │
│ Sannsynlig årsak: Employee Token er utløpt eller    │
│ revoked.                                            │
│                                                     │
│ [ Re-konfigurer ]  (åpner Steg 2 av wizard på nytt) │
└─────────────────────────────────────────────────────┘
```

#### DISCONNECTED-tilstand

```
┌─────────────────────────────────────────────────────┐
│ ✕ Frakoblet                                         │
│                                                     │
│ Tripletex er frakoblet siden 20.05.2026.            │
│ Vi sletter credentials endelig om 28 dager          │
│ (19.06.2026).                                       │
│                                                     │
│ Inntil da kan du koble til igjen uten ny token.     │
│                                                     │
│ [ Koble til igjen ]      [ Slett nå ]               │
└─────────────────────────────────────────────────────┘
```

#### Multi-env (produktbeslutning #6)

Env-toggle (`[PROD ▼]`) tillater provider-admin å bytte mellom test- og prod-tilkobling. To separate connection-states, lagret i samme tabell med `env`-kolonne.

```
┌─────────────────────────────────┐
│ [ TEST ▼ ]                      │
│   ● Tilkoblet (test)            │
│   Selskap: Test-konto (123456)  │
│                                 │
│ [ PROD ▼ ]                      │
│   ● Tilkoblet (prod)            │
│   Selskap: Provider Catering AS │
└─────────────────────────────────┘
```

---

## 5. Komponent-hierarki (designsystem)

### 5.1 Sidestruktur

Wizard kjøres i `/leverandor/innstillinger/regnskap/koble-til` (modal- eller wizard-mønster, ikke separat side per steg, for å bevare back-button-state).

Dashboard er `/leverandor/innstillinger/regnskap`.

### 5.2 Brukte klasser

Eksisterende `ds-*` klasser:

| Klasse | Bruk i onboarding |
|---|---|
| `.ds-page`, `.ds-container`, `.ds-section` | Sidestruktur |
| `.ds-text-limit` | Max 760px brødtekst i instruks-paneler |
| `.ds-surface` | Kort-bakgrunn for wizard-steg |
| `.ds-h2`, `.ds-h3`, `.ds-lead`, `.ds-body`, `.ds-body-sm` | Typografi-hierarki |
| `.ds-eyebrow` | "Steg X av 4"-label |
| `.ds-btn.ds-btn--primary` | Hovedhandling per steg ("Fortsett", "Verifiser") |
| `.ds-btn.ds-btn--secondary` | Sekundære handlinger ("Tilbake", "Lukk og fortsett senere") |
| `.ds-cards-3`, `.ds-card` | Aktivitetsstatistikk på dashboard |
| `.ds-section--social-proof` (variant) | Statistikk-grid på dashboard |

Eksisterende `lp-*` klasser brukes ikke direkte her — onboarding er innenfor app-konteksten, ikke landingsblokker.

### 5.3 Nye klasser som må legges til `design-system.css`

Disse er onboarding-spesifikke og bør utvide systemet, ikke omgå det:

```css
/* Wizard-shell */
.ds-wizard {
  max-width: 720px;
  margin-inline: auto;
}

.ds-wizard__progress {
  display: flex;
  gap: 8px;
  margin-block-end: 24px;
}

.ds-wizard__progress-step {
  flex: 1;
  height: 4px;
  border-radius: var(--ds-radius-pill);
  background: var(--ds-line);
  transition: background-color .3s var(--ds-ease);
}

.ds-wizard__progress-step--complete {
  background: var(--ds-green);
}

.ds-wizard__progress-step--current {
  background: var(--ds-accent);
}

/* Verification feedback */
.ds-verify-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-block: 24px;
}

.ds-verify-item {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ds-verify-item__icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.ds-verify-item--pending .ds-verify-item__icon {
  /* spinner via SVG, respekterer prefers-reduced-motion */
}

.ds-verify-item--success .ds-verify-item__icon { color: var(--ds-green); }
.ds-verify-item--error   .ds-verify-item__icon { color: #c0392b; }

/* Status badges (dashboard) */
.ds-status-badge {
  display: inline-flex;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--ds-radius-pill);
  font-size: var(--ds-body-sm);
  font-weight: 500;
  align-items: center;
}

.ds-status-badge::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ds-status-badge--connected    { background: rgba(47,122,101,.12); color: var(--ds-green); }
.ds-status-badge--connected::before { background: var(--ds-green); }

.ds-status-badge--configuring  { background: var(--ds-accent-soft); color: var(--lp-gold-dark); }
.ds-status-badge--configuring::before { background: var(--ds-accent); animation: ds-pulse 1.4s infinite; }

.ds-status-badge--degraded     { background: rgba(245,180,0,.18); color: var(--lp-gold-dark); }
.ds-status-badge--degraded::before { background: var(--ds-accent); }

.ds-status-badge--disconnected { background: rgba(192,57,43,.10); color: #c0392b; }
.ds-status-badge--disconnected::before { background: #c0392b; }

@keyframes ds-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .35; }
}

@media (prefers-reduced-motion: reduce) {
  .ds-status-badge--configuring::before { animation: none; }
}

/* Secret-display (one-time view) */
.ds-secret-display {
  font-family: ui-monospace, monospace;
  background: var(--ds-bg-soft);
  border: 1px solid var(--ds-line-strong);
  border-radius: var(--ds-radius-sm);
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  word-break: break-all;
}

.ds-secret-warning {
  background: rgba(245,180,0,.10);
  border-inline-start: 4px solid var(--ds-accent);
  padding: 14px 18px;
  border-radius: var(--ds-radius-sm);
  font-size: var(--ds-body-sm);
  margin-block: 16px;
}
```

Disse legges til `design-system.css` (globalt) fordi de er gjenbrukbare mønstre — wizard kan komme tilbake i andre kontekster, status-badge brukes overalt.

### 5.4 Mobile-first responsivitet

Wizard skal fungere på 320px-bredde (eldre mobiler). Konkret:

```css
.ds-wizard {
  /* Default: mobile */
  padding-inline: 16px;
}

@media (min-width: 640px) {
  .ds-wizard { padding-inline: 24px; }
}

@media (min-width: 980px) {
  .ds-wizard { padding-inline: 0; }  /* container handler det */
}

/* Wizard buttons stack on mobile */
.ds-wizard__actions {
  display: flex;
  flex-direction: column-reverse;  /* primær først på mobil */
  gap: 12px;
}

@media (min-width: 640px) {
  .ds-wizard__actions {
    flex-direction: row;
    justify-content: space-between;
  }
}

/* Video-embed responsive */
.ds-wizard__video {
  aspect-ratio: 16 / 9;
  max-width: 100%;
  margin-block: 16px;
}
```

### 5.5 Tilgjengelighet

- Alle interaktive elementer: `:focus-visible` gir gul outline-ring (3px offset)
- Wizard-progress: `aria-current="step"` på aktiv step, `aria-label="Steg 2 av 4: Verifiser token"` på container
- Secret-display copy-button: `aria-label="Kopier webhook-secret. Vises kun denne ene gangen."`
- Video: `<track kind="captions" srclang="no" />` påkrevd, ikke optional
- Status-badges har redundant tekst, ikke bare farge
- Reduced-motion: pulse-animasjon stoppes, spinner-icons byttes med statisk "..."

---

## 6. Error State Catalog

Hver feil har: utløsende tilstand, brukermelding, foreslått handling, log-event.

### 6.1 Steg 0 — Preflight

| Feil | Brukermelding | Handling | Log-event |
|---|---|---|---|
| Ingen `provider_admin`-rolle | "Du må være provider-admin for å koble til Tripletex. Be en admin om hjelp." | Vis kontakt-info til provider-admins i firmaet | `tripletex_onboarding_unauthorized` |
| Allerede `CONNECTED` for env | (Send til dashboard, ikke wizard) | — | — |

### 6.2 Steg 1 — Token generation guide

| Feil | Brukermelding | Handling | Log-event |
|---|---|---|---|
| Company ID ikke numerisk | "Company ID må bestå av kun siffer. Format: 9 sifre." | Rød ramme + inline-hint | `tripletex_onboarding_invalid_input` (debounced) |
| Company ID lengde feil | "Company ID skal være mellom 6 og 12 siffer." | Rød ramme + inline-hint | (samme) |

### 6.3 Steg 2 — Three-step verification

| Feil | Brukermelding | Handling | Log-event |
|---|---|---|---|
| `/v2/whoAmI` 401 | "Tokenet ble avvist av Tripletex. Sjekk at du kopierte hele tokenet uten mellomrom." | Behold company_id, tøm token-felt, fokus tilbake til token-input | `tripletex_onboarding_auth_fail` |
| `/v2/whoAmI` 403 | "Tokenet er gyldig, men kontoen din i Tripletex har ikke API-tilgang. Sjekk Smart/Komplett-pakken." | Lenke til Tripletex' abonnementsside | `tripletex_onboarding_no_api_access` |
| Company ID mismatch | "Tokenet tilhører en annen Tripletex-konto enn det du oppga ({actualCompanyId}). Sjekk at company_id stemmer." | Behold token, korriger company_id | `tripletex_onboarding_company_mismatch` |
| `/v2/product` 403 | "Tokenet mangler tilgang til produktkatalogen. Gå tilbake til Tripletex og generér ny nøkkel med 'Alle tilganger'." | Lenke tilbake til Steg 1, behold company_id | `tripletex_onboarding_insufficient_scope` |
| Tripletex 5xx | "Tripletex svarer ikke akkurat nå. Vent et minutt og prøv igjen." | Retry-button, samme state | `tripletex_onboarding_tripletex_5xx` |
| Network timeout | "Vi får ikke kontakt med Tripletex. Sjekk internett-tilkoblingen din." | Retry-button | `tripletex_onboarding_network_timeout` |

### 6.4 Steg 3 — Auto-provisioning

| Feil | Brukermelding | Handling | Log-event |
|---|---|---|---|
| `ensureProviderVatCode` 409 | (Silent — 409 betyr eksisterer) | Fortsett | (debug-log) |
| `ensureProviderProduct` 409 | (Silent) | Fortsett | (debug-log) |
| `ensureCompanyCustomer` validation error for én company | "Kunden {companyName} mangler organisasjonsnummer i Lp og kunne ikke synkroniseres. Du kan fakturere de andre kundene, og legge til org-nummer senere." | Vis i "Trenger oppmerksomhet"-liste på dashboard, ikke blokker | `tripletex_onboarding_customer_skipped` |
| 5xx fra Tripletex midt i bulk | (Pause med retry-knapp) "Vi fikk en midlertidig feil etter {N} av {M} kunder. Trykk for å fortsette." | Resumable progress | `tripletex_onboarding_provisioning_paused` |

### 6.5 Steg 4 — Webhook registration

| Feil | Brukermelding | Handling | Log-event |
|---|---|---|---|
| Provider lukker fanen før secret kopiert | (Ingen feil — secret er rotert, må roteres på nytt) | Når de kommer tilbake: "Du forlot Steg 4. Vi må generere ny secret." | `tripletex_onboarding_secret_abandoned` |

### 6.6 Etter onboarding — runtime

| Feil | Brukermelding | Handling | Log-event |
|---|---|---|---|
| Health check 401 (3 ganger) | (Dashboard banner) "Tripletex avviser tokenet vårt. Det kan være utløpt eller revoked." | Reconfigure-link | `tripletex_health_token_revoked` |
| Webhook silence > 7 dager med invoices sent | "Vi har ikke mottatt webhook-events fra Tripletex på 7 dager. Sjekk at webhook fortsatt er registrert." | Lenke til Tripletex' webhook-side | `tripletex_health_webhook_silent` |
| Worker-failures siste 24h > 0 | "Siste {N} faktura-pushes feilet. Se detaljer." | Vis error-detaljer per invoice | `tripletex_health_worker_failures` |

---

## 7. RPC-kontrakter (nye for B-7)

Alle disse legges til i én migrasjon: `supabase/migrations/{YYYYMMDD}_tpt_b7_onboarding_rpcs.sql`. Service-role-only der ikke annet er spesifisert.

### 7.1 `lp_provider_test_tripletex_token`

**Steg 2 — three-step verification.**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text ('test' | 'prod')
  p_tripletex_company_id bigint
  p_employee_token text

RETURNS jsonb:
  {
    "auth": { "ok": bool, "company_id": bigint, "error": text },
    "company_match": { "ok": bool, "error": text },
    "scope": { "ok": bool, "error": text },
    "all_passed": bool
  }

AUTH:
  provider_admin for p_provider_id, OR superadmin

BEHAVIOR:
  - Calls Tripletex /v2/whoAmI with (consumer_token, p_employee_token)
  - Compares whoAmI.companyId to p_tripletex_company_id
  - Calls /v2/product?count=1 to verify scope
  - Returns all three results regardless of which fail
  - Does NOT persist token (only validates)
  - Audit-log: tripletex_onboarding_test_token (with all_passed result)
```

### 7.2 `lp_provider_complete_tripletex_connection`

**Persist tokens etter at alle tre verifications passerer.**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text
  p_tripletex_company_id bigint
  p_employee_token text  -- written to Vault, never logged

RETURNS jsonb:
  {
    "connection_state": "CONFIGURING",
    "provisioning_started": bool
  }

AUTH:
  provider_admin for p_provider_id, OR superadmin

BEHAVIOR:
  - Re-runs lp_provider_test_tripletex_token (defense in depth)
  - If all_passed=false: raises exception, no state change
  - Stores Employee Token in Vault (same secret-namespace as B-1)
  - Stores Tripletex Company ID in provider_tripletex_credentials
  - Sets connection_state = 'CONFIGURING'
  - Enqueues outbox event tripletex.onboarding_provisioning_start:{provider_id}:{env}
  - Audit-log: tripletex_onboarding_connection_started
```

### 7.3 `lp_provider_complete_onboarding_provisioning`

**Kalles av worker som behandler `tripletex.onboarding_provisioning_start`-event.**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text

RETURNS jsonb:
  {
    "vat_codes_ensured": int,
    "products_ensured": int,
    "customers_ensured": int,
    "customers_skipped": int,
    "skipped_details": jsonb,
    "duration_ms": int
  }

AUTH:
  service_role only

BEHAVIOR:
  - Bulk-iterates: VAT codes, products, customers for ACTIVE agreements
  - For each customer that fails validation: collects in skipped_details
  - Does NOT transition connection_state — only marks
    onboarding_provisioning_complete_at timestamp
  - Audit-log per skipped customer + per run summary
```

### 7.4 `lp_provider_finalize_tripletex_connection`

**Steg 4 — etter at provider bekrefter webhook registrert.**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text

RETURNS jsonb:
  {
    "connection_state": "CONNECTED",
    "ready_for_billing": bool
  }

AUTH:
  provider_admin for p_provider_id, OR superadmin

BEHAVIOR:
  - Verifies onboarding_provisioning_complete_at is set
  - Verifies webhook_secret has been rotated (i.e., provider went through step 4)
  - Transitions connection_state to 'CONNECTED'
  - Sets state_changed_at = now()
  - Audit-log: tripletex_onboarding_finalized
```

### 7.5 `lp_provider_disconnect_tripletex`

**Soft-disconnect (produktbeslutning #5).**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text

RETURNS jsonb:
  {
    "connection_state": "DISCONNECTED",
    "vault_purge_at": timestamptz,
    "days_until_purge": int
  }

AUTH:
  provider_admin for p_provider_id, OR superadmin

BEHAVIOR:
  - Sets connection_state = 'DISCONNECTED'
  - Sets disconnected_at = now()
  - Sets vault_purge_at = now() + interval '30 days'
  - DOES NOT delete tokens or webhook_secret yet
  - Audit-log: tripletex_onboarding_disconnected
```

### 7.6 `lp_provider_reconnect_tripletex`

**Reactivate uten ny token (i 30-dagers grace).**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text

RETURNS jsonb:
  {
    "connection_state": "CONFIGURING",
    "validation_required": bool  -- true: re-run lp_provider_test_tripletex_token
  }

AUTH:
  provider_admin

BEHAVIOR:
  - Only allowed if current state is DISCONNECTED AND
    vault_purge_at > now()
  - Sets connection_state = 'CONFIGURING'
  - Clears disconnected_at and vault_purge_at
  - Triggers re-validation (UI calls lp_provider_test_tripletex_token first)
  - Audit-log: tripletex_onboarding_reconnect_initiated
```

### 7.7 `lp_provider_get_connection_health`

**Dashboard data.**

```
ARGUMENTS:
  p_provider_id uuid
  p_env text

RETURNS jsonb:
  {
    "state": text,
    "state_since": timestamptz,
    "tripletex_company_id": bigint,
    "tripletex_company_name": text,  -- cached from last whoAmI
    "last_health_check": timestamptz,
    "stats_30d": {
      "invoices_sent": int,
      "invoices_paid": int,
      "worker_failures": int,
      "webhook_events": int
    },
    "recent_events": [/* last 10 from lp_audit_log */],
    "warnings": [/* DEGRADED-reasons if applicable */]
  }

AUTH:
  provider_admin OR any role within provider (read-only)
```

### 7.8 `lp_provider_rotate_webhook_secret` (allerede levert i B-6)

Brukes uendret. UI viser returnert secret én gang.

---

## 8. Sikkerhetsmodell

### 8.1 Secret-håndtering

| Secret | Lagring | Lifecycle | Exposure |
|---|---|---|---|
| Employee Token | Supabase Vault (via B-1 mechanism) | Lagres ved Steg 2-success, slettes ved vault_purge_at | Aldri returnert i RPC-svar; aldri loggført |
| Webhook secret | Supabase Vault (samme namespace) | Genereres i Steg 4 (eller rotert manuelt), vises én gang i UI, slettes ved vault_purge_at | Returneres KUN fra `lp_provider_rotate_webhook_secret` (RPC-call, ikke GET) |
| Lp's egen Consumer Token | Env vars (server-side only) | Statisk per integrasjon | Aldri klient-side |

**Aldri:**
- Logger ikke noen tokens, secrets, eller PII i `lp_audit_log` payload
- Returnerer ikke tokens i `lp_provider_get_connection_health` (kun status)
- Eksponerer ikke webhook-URL med secret i query-string — secret er separat input til Tripletex' webhook-konfig

### 8.2 Role-gating (produktbeslutning #4)

Onboarding-RPCer er gated til `provider_admin` for `provider_id`:

```sql
-- Standard guard-pattern (gjenbrukbart fra eksisterende migrations)
CREATE OR REPLACE FUNCTION _lp_require_provider_admin(p_provider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM provider_memberships pm
    WHERE pm.provider_id = p_provider_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'provider_admin'
      AND pm.deleted_at IS NULL
  ) AND NOT _lp_is_superadmin() THEN
    RAISE EXCEPTION 'permission denied: provider_admin required'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
```

`Connection health` (read-only) tillater alle med role inside provider — provider_admin, employee, viewer.

### 8.3 Webhook re-verification chain

Selv etter HMAC og at vi finner riktig invoice via `tripletex_invoice_id`, kjører vi:

1. HMAC-verify (B-6) — bekrefter at request kom fra noen som har secret
2. Tripletex API re-verify (B-6) — kaller `GET /v2/invoice/:id` mot provider's Tripletex, sjekker `amountOutstanding <= 0`
3. State-machine sjekk (B-6 `lp_apply_tripletex_paid_status`) — kun SENT → PAID tillates

Tre-lags forsvar. Hvis én sviktes (eks: HMAC-secret lekket), de to andre stopper feil-transition.

### 8.4 Audit-trail

Alle disse events lagres i `lp_audit_log`:

```
tripletex_onboarding_test_token        -- with three-step result
tripletex_onboarding_connection_started -- token persisted
tripletex_onboarding_provisioning_*    -- bulk-results
tripletex_onboarding_finalized         -- state → CONNECTED
tripletex_onboarding_disconnected      -- state → DISCONNECTED
tripletex_onboarding_reconnect_initiated
tripletex_onboarding_secret_rotated    -- (delegates til B-6's existing event)
tripletex_health_check                 -- daily cron result
tripletex_connection_state_change      -- generic state transition
```

Hver entry inkluderer: `actor_user_id`, `provider_id`, `env`, `previous_state`, `new_state`, `request_rid`. Aldri tokens eller secrets.

### 8.5 Threat model

| Trussel | Mitigasjon |
|---|---|
| Token-tyveri via XSS i Lp's UI | Token sendes kun fra wizard til server, lagres aldri i localStorage/sessionStorage. CSP-policy forhindrer inline scripts |
| Webhook-secret tyveri ved MITM | HTTPS enforced. Tripletex' webhook-registrering bør bruke HTTPS-URL. Re-verification gir defense in depth |
| Compromised provider-admin account | Audit-trail viser hvem som kjørte hvilket steg, når. Reconnect krever re-validation via Tripletex API |
| Replay-attack på webhook | `tripletex_webhook_events` UNIQUE på `(provider_id, env, tripletex_event_id)` (B-6) |
| Insider misuse (Lp-staff) | Superadmin-handlinger logges separat. Vault-access kreves separat fra DB-access |
| Token replay etter disconnect | Vault-purge ved `vault_purge_at`. Token kan ikke reaktiveres uten ny token etter 30 dager |

---

## 9. Testing-strategi

### 9.1 Unit-tester (per komponent)

```
tests/components/leverandor/regnskap/
  wizard.test.tsx
  step-preflight.test.tsx
  step-token-input.test.tsx
  step-verification-feedback.test.tsx
  step-provisioning-progress.test.tsx
  step-webhook-secret.test.tsx
  connection-dashboard.test.tsx
  secret-display.test.tsx       -- copy-button, one-time-show
  status-badge.test.tsx
```

Hver komponent testes for: render, prop-variants, user-interaction (vitest + @testing-library/react), accessibility (axe-core), reduced-motion-respekt.

### 9.2 RPC-tester

```
tests/db/lp_provider_test_tripletex_token.test.ts
tests/db/lp_provider_complete_tripletex_connection.test.ts
tests/db/lp_provider_complete_onboarding_provisioning.test.ts
tests/db/lp_provider_finalize_tripletex_connection.test.ts
tests/db/lp_provider_disconnect_tripletex.test.ts
tests/db/lp_provider_reconnect_tripletex.test.ts
tests/db/lp_provider_get_connection_health.test.ts
```

Per RPC: auth (provider_admin / employee / cross-provider / superadmin), state-transitions (gyldig + ugyldig), idempotency, audit-log-verifisering.

### 9.3 Integration-tester (med mocked Tripletex)

```
tests/integrations/onboarding-flow-happy-path.test.ts
tests/integrations/onboarding-flow-token-rejected.test.ts
tests/integrations/onboarding-flow-company-mismatch.test.ts
tests/integrations/onboarding-flow-scope-insufficient.test.ts
tests/integrations/onboarding-flow-provisioning-partial.test.ts
tests/integrations/onboarding-flow-disconnect-reconnect.test.ts
tests/integrations/onboarding-flow-30day-grace-purge.test.ts
tests/integrations/marketplace-redirect-known-provider.test.ts
tests/integrations/marketplace-redirect-unknown-provider.test.ts
```

Bruker MSW (Mock Service Worker) for å stubbe Tripletex API. Følger samme mønster som B-4 og B-6.

### 9.4 E2E-tester (Playwright)

```
e2e/onboarding/wizard-full-flow.spec.ts
e2e/onboarding/dashboard-degraded-state.spec.ts
e2e/onboarding/multi-env-toggle.spec.ts
e2e/onboarding/mobile-wizard.spec.ts  -- iPhone 12 viewport
```

E2E kjøres i CI, ikke i pre-push hook (for langsomt). Smoke-test mot staging etter deploy.

### 9.5 Manuelle smoke-test-runbooks

```
docs/runbooks/tripletex-onboarding-smoke.md
```

Trinn for trinn smoke-test mot ekte Tripletex test-env, kjøres manuelt etter prod-deploy av hver B-7-patch.

### 9.6 Test-coverage-mål

- Per RPC: ≥ 4 cases (auth + happy + edge + state-transition)
- Per komponent: ≥ 3 cases (render + interaction + a11y)
- Integration: ≥ 9 cases (dekker alle FOREVENTEDE feilsituasjoner)
- E2E: 4 spec-filer, hver med 2-4 scenarios

Forventet test-tilskudd: ~80-100 nye tester på tvers av B-7a/b/c.

---

## 10. Implementation Roadmap

Backend er ferdig. Disse patcher implementerer kun frontend + nye RPC-er for onboarding.

### 10.1 Rekkefølge og avhengigheter

```
B-7-foundation  ──→  B-7b (Direct wizard)  ──→  B-7c (Health dashboard)
                          │                          │
                          ↓                          ↓
                  B-7a (Marketplace        Aktivér i prod
                       redirect)
```

**B-7-foundation må komme først** — den inneholder de delte RPC-ene og state-machine-migrasjonen.

### 10.2 Patch-spesifikasjoner

#### TPT-B-7-foundation

**Estimat:** 90-120 min.

I scope:
- Migration: utvide `provider_tripletex_credentials` med state-felt (jf. seksjon 3.3)
- Migration: legge til alle 7 nye RPC-er (jf. seksjon 7)
- Migration: outbox event-handler-registrering for `tripletex.onboarding_provisioning_start`
- Worker: `handleOnboardingProvisioningStart` i `lib/integrations/tripletex/onboardingSync.ts`
- Cron: `/api/cron/tripletex-connection-health-daily` (B-7c-forberedelse)
- CSS: nye `ds-wizard__*`, `ds-verify-*`, `ds-status-badge--*`, `ds-secret-*` klasser i `design-system.css`
- Tester: RPC-tester (7 filer) + worker-test + cron-test

#### TPT-B-7a — Marketplace Redirect Handler

**Estimat:** 60-90 min. **Forutsetter:** B-7-foundation.

I scope:
- Endpoint `app/api/integrations/tripletex/install/route.ts` (POST, x-www-form-urlencoded)
- JWT-signed callback-URL til `/leverandor/innstillinger/regnskap/tripletex-callback`
- Provider-matcher logikk basert på `org_number`
- Callback-page som auto-kjører Steg 3 + Steg 4 (provisioning + webhook)
- Tester: integration-tester for både matched og unmatched provider

Aktivt produsert men ikke "live" før Tripletex Marketplace-godkjenning. Endpoint sender 200 OK på alle gyldige POSTs og logger audit, så vi har observability fra dag 1 (selv om ingen sender til den ennå).

#### TPT-B-7b — Direct Wizard (PRIMARY)

**Estimat:** 240-360 min (største patch i B-serien). **Forutsetter:** B-7-foundation.

I scope:
- Wizard-shell-komponent `components/leverandor/regnskap/Wizard.tsx`
- 5 step-komponenter (Preflight, TokenInput, Verification, Provisioning, WebhookSecret)
- Modal- eller drawer-mønster (avklar via discovery av eksisterende app-patterns)
- API-routes for hver RPC (Server Actions eller Route Handlers)
- Video-content-strategi: produser 4-5 korte videoer (henvises som TODO til content-team, ikke kode-arbeid)
- Tester: unit per komponent + integration for full flow

Vurder splitting i B-7b og B-7b' hvis Cursor anslår > 360 min.

#### TPT-B-7c — Connection Health Dashboard

**Estimat:** 150-210 min. **Forutsetter:** B-7-foundation + B-7b.

I scope:
- Dashboard-side `app/leverandor/innstillinger/regnskap/page.tsx`
- Conditional rendering basert på `connection_state`
- Status-badge, stats-cards, recent-events-liste
- "Roter secret"-modal (gjenbruker SecretDisplay-komponent fra B-7b)
- "Koble fra"-bekreftelses-modal med 30-dagers grace-forklaring
- "Send test-faktura"-knapp (skaper en draft-invoice + kjører gjennom B-3/B-4 manuelt)
- Multi-env toggle
- Tester: integration-tester for hver state (CONNECTED/DEGRADED/DISCONNECTED)

#### TPT-B-7-final — Polish + Production-readiness

**Estimat:** 60-90 min. **Forutsetter:** alle ovenfor.

- Smoke-test runbook (`docs/runbooks/tripletex-onboarding-smoke.md`)
- Helpcenter-artikkel (i Umbraco, kjøres av content-team — vi leverer tekst-utkast)
- Vercel cron registrering for health-daily
- Manuell smoke mot Tripletex test-env
- Plan v3.14: TPT-B-7 ✅ COMPLETED, Flow B 7/7 inkludert UI

### 10.3 Discovery-spørsmål før koding starter

Disse må Cursor avklare i FASE 0c på første patch (B-7-foundation):

1. Bruker app/leverandor/innstillinger/regnskap allerede en wizard-pattern? (Hvis ja, gjenbruk; hvis nei, etabler nytt mønster og dokumenter)
2. Hvordan ser eksisterende `lp_audit_log`-struktur ut for `event_type=tripletex_*`?
3. Brukes Server Actions eller Route Handlers i Lp's app-side? (Påvirker hvordan RPC-er kalles fra wizard)
4. Eksisterer det allerede en `_lp_require_provider_admin` helper, eller må vi etablere den?
5. Hvor lagres video-content (CDN, Umbraco media library, S3)? Påvirker `<video src>` URL-strategi
6. Hvilken provider-side eksisterer allerede? (Mocking-strategi for tester avhenger av dette)

### 10.4 Total estimat

| Patch | Min | Maks |
|---|---|---|
| B-7-foundation | 90 | 120 |
| B-7a | 60 | 90 |
| B-7b | 240 | 360 |
| B-7c | 150 | 210 |
| B-7-final | 60 | 90 |
| **Total** | **600 (10 t)** | **870 (14.5 t)** |

Forventet kalender: 3-5 arbeidsdager med Cursor som primær utvikler, pluss content-team tid for video-produksjon (separat track).

---

## 11. Open Questions for Follow-up

Ikke blocking for B-7-foundation, men bør avklares før B-7b begynner:

1. **Video-produksjon:** Hvem produserer de 4-5 korte videoene? Internt eller outsourced? Format (MP4 H.264) og oppløsning?
2. **Help-center i Umbraco:** Skal vi etablere en seksjon for tekniske integrasjons-guides nå, eller leve med inline-guides i wizard inntil videre?
3. **Multi-language:** Norsk er default. Skal wizard støtte engelsk fra dag 1 for internasjonale provider-teams?
4. **Onboarding-metrics dashboard for Lp-staff:** Skal vi bygge en intern superadmin-view som viser onboarding-funnel (start → step 1 → step 4 → fullført)? Verdifullt for support, men ut-av-scope for B-7.
5. **Sandbox-mode:** Skal Lp ha en "test mode" der providere kan koble til Tripletex test-env uten reelle fakturaer? Multi-env (#6) støtter dette delvis, men det er ikke en eksplisitt "sandbox"-toggle.

---

## 12. Appendix

### 12.1 Reference: Tripletex API endpoints brukt

| Endpoint | Method | Bruk |
|---|---|---|
| `/v2/whoAmI` | GET | Steg 2 auth-verify; daglig health-check |
| `/v2/company` | (implisitt via whoAmI) | Steg 2 company_id-match |
| `/v2/product?count=1` | GET | Steg 2 scope-verify |
| `/v2/product` | POST/GET | B-2 ensureProviderProduct (under hood) |
| `/v2/vatType` | GET | B-2 ensureProviderVatCode (under hood) |
| `/v2/customer` | POST/GET | B-2 ensureCompanyCustomer (under hood) |
| `/v2/order` | POST | B-4 invoice push |
| `/v2/order/:id/:invoice` | PUT | B-4 invoice push (status transition) |
| `/v2/invoice/:id` | GET | B-6 re-verification |

### 12.2 Reference: Industri-eksempler

Tripletex-integrasjoner som har lignende onboarding-mønster (research-basert):

- **Svenn:** 2-felt skjema (token + key-name). Ingen wizard, ingen video. Funksjonelt minimum.
- **Gripr:** Aktivér-knapp → instruksjoner → lim inn token. Tilsvarende.
- **RecMan:** "Activate" → guide til Tripletex' API-key generering → paste key + dept-mapping. Lengre flow enn Svenn/Gripr.
- **Tribe CRM:** Marketplace-redirect-flyt (de er Marketplace-godkjent). Mest sømløst.
- **Morescope:** Eksplisitt instruksjon om å hente `contextId` fra URL. Closest til vår wizard.

Vår wizard er bevisst mer ambisiøs enn alle disse, fordi vi sikter på enterprise-grade self-service onboarding fra dag 1.

### 12.3 Glossary

| Term | Definisjon |
|---|---|
| Consumer Token | Lp's egen integrasjons-identifikator fra Tripletex, lagret i env vars |
| Employee Token | Provider's bruker-spesifikke API-nøkkel fra Tripletex |
| Session Token | Kort-levd token fra `/v2/token/session/:create`, returner fra Lp's auth-helper |
| Tripletex Company ID | Numerisk ID for et selskap i Tripletex (eks 114612665, fra URL `contextId=`) |
| Provider | Catering-firma i Lp som har avtaler med companies |
| Company | Lp's kunde (firmaet som mottar fakturaer fra en provider) |
| Agreement | Kontrakt mellom provider og company, med billing_cycle og tier |
| Outbox event | DB-row som workers polles for å dispatche til Tripletex |
| `closegroup.create` | Tripletex webhook-event for OCR/betaling (primary trigger for B-6) |

---

**Slutt på dokument.**
*Neste handling: review av dette dokumentet, deretter prompt for TPT-B-7-foundation.*
