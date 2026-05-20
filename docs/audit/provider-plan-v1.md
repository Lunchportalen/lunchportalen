# PROVIDER-PLAN-V1

> Multi-leverandør SaaS-arkitektur for Lunchportalen
> Versjon 1 — basert på PROVIDER-AUDIT v1 (2026-05-20)
> Status: DRAFT for review
> Tilhørende fase: Phase E (innskutt mellom B4.2.1 og B4.2.2)

---

## Innholdsfortegnelse

1. [Executive Summary](#1-executive-summary)
2. [Forretningsmodell](#2-forretningsmodell)
3. [Arkitektur-overview](#3-arkitektur-overview)
4. [Datamodell](#4-datamodell)
5. [Roller og RBAC](#5-roller-og-rbac)
6. [Suspend / Pause / Delete-hierarki](#6-suspend--pause--delete-hierarki)
7. [RLS-strategi](#7-rls-strategi)
8. [Sanity provider-scope](#8-sanity-provider-scope)
9. [UI-arkitektur](#9-ui-arkitektur)
10. [Migration-strategi](#10-migration-strategi)
11. [Patch-sekvens 2.2 → 15](#11-patch-sekvens-22--15)
12. [Risk-matrise](#12-risk-matrise)
13. [Testing-strategi](#13-testing-strategi)
14. [Phase F outline (Recipe & Margin)](#14-phase-f-outline-recipe--margin-engine)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

Lunchportalen pivoterer fra single-tenant til **multi-leverandør SaaS-plattform**. Hver leverandør (provider) eier sine egne kunder (companies), sin egen meny og sin egen fakturering. Lunchportalen leverer drift, registreringsflyt, bestillingsflyt, kjøkken-dashboard og rapportering — som B2B SaaS-tjeneste mot leverandørene.

**Første konkrete provider:** Melhus Catering AS i Trondheim. Phase E bygger arkitekturen som lar oss onboarde andre leverandører (Bergen, Oslo, Stavanger) uten kodeendring.

**Scope:** 13 patches over estimert 4-8 uker fokusert arbeid. Phase F (Recipe & Margin Engine) etterfølger.

**Hovedendringer:**
- Ny øvre entitet `providers` over eksisterende `companies`
- Provider-membership-mønster speiler eksisterende company-memberships
- RLS-policies utvides stegvis for provider-scope (~190 policies, kjerne-tabeller først)
- Sanity menuDay får provider-referanse
- Ny `/leverandor` UI-shell parallelt med eksisterende `/admin`
- Suspend/pause/delete-hierarki med audit log på alle handlinger

**Hva endres ikke:** Umbraco-laget, core JWT/session/auth-flow, eksisterende `company_admin`-rolle, B5-B8 roadmap.

---

## 2. Forretningsmodell

### 2.1 Hierarki

```
Lunchportalen (Platform)
  ↓
  Provider/Leverandør (Melhus Catering, fremtidige andre)
    ↓
    Company/Kunde (Acme AS, Bedrift B, Bedrift C)
      ↓
      Agreement (BASIS/LUXUS/ENTERPRISE plan)
        ↓
        Location (kontorbygg, avdeling)
          ↓
          User/Ansatt
            ↓
            Order (bestilling)
```

### 2.2 Ansvar og inntekt

| Aktør | Eier | Inntekt fra |
|---|---|---|
| Lunchportalen | Drift, UI, registrering, ordreflyt, kjøkken-dashboard, rapporter | SaaS-lisens per provider + per aktiv company |
| Provider | Kunde-relasjon, mat, levering, fakturering | Selger mat til Company via egen faktura |
| Company | Bedriftsavtale med Provider | Betaler Provider for mat |
| Employee | Bestiller egen lunsj | n/a |

### 2.3 Prising

| Modell | Beskrivelse | Anbefalt for |
|---|---|---|
| Fast SaaS-lisens | 990 kr/mnd per provider | Phase E (MVP) |
| Per aktiv company | 299 kr/mnd per company på en provider | Phase E (vurder kombinasjon) |
| Volumbasert | 1-3 kr per bestilling | **IKKE** anbefalt — krever tillit + rapportering |

**Phase E-prising:** Fast SaaS-lisens + per aktiv company. Ingen transaksjonsavgift i MVP.

### 2.4 Juridisk avgrensning

Lunchportalen er **ikke** matvareselger eller juridisk mellomledd. Avtaletekst og systemlogikk presiserer:

> "Lunsjleverandøren er ansvarlig for mat, levering, priser, fakturering og kundeavtale. Lunchportalen leverer digital bestillings- og administrasjonsplattform."

---

## 3. Arkitektur-overview

### 3.1 System-lag (uendret fra hardregler)

| Lag | Ansvar | Endres i Phase E? |
|---|---|---|
| Umbraco | Marketing-content (lunchportalen.no) | Nei |
| Sanity | Meny, ukeplan, productPlan | Ja — provider-scope |
| Supabase | Operasjonell sannhet | Ja — provider-tabeller |
| Next.js | App-logikk (app.lunchportalen.no) | Ja — leverandør-shell |

### 3.2 Provider-modellens innvirkning

Provider er ny **toppentitet** over Company. Alle operasjonelle tabeller får `provider_id` for scoping:

| Tabell | provider_id | Begrunnelse |
|---|---|---|
| `companies` | FK → providers | Hver company tilhører én provider |
| `agreements` | FK → providers | Konsistens-redundans for query-effektivitet |
| `orders` | FK → providers | Kjøkken-views, sikkerhet, rapportering |
| `company_registrations` | FK → providers | Registreringsforespørsel scoped per provider |
| `menu_service_days` | FK → providers | Menyer per provider |

### 3.3 Scoping-mønstre

Tre nivåer av scoping eksisterer etter Phase E:

1. **Platform-scope** — Lunchportalen sentralt, ser alt
2. **Provider-scope** — Provider Admin ser sine companies, sine ordrer
3. **Company-scope** — Company Admin ser sine employees, sine ordrer (uendret fra i dag)

RLS-policies oppdateres slik at **provider-scope er ADDITIV** til eksisterende company-scope. Ingen eksisterende access fjernes.

---

## 4. Datamodell

### 4.1 Nye tabeller

#### `providers`

```sql
CREATE TABLE public.providers (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text NOT NULL UNIQUE,
    slug              text NOT NULL UNIQUE,
    org_number        text UNIQUE,
    status            provider_status NOT NULL DEFAULT 'ACTIVE',
    contact_email     text NOT NULL,
    contact_phone     text,
    logo_url          text,
    primary_color     text,
    description       text,
    billing_model     text NOT NULL DEFAULT 'SAAS_FIXED',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    suspended_at      timestamptz,
    suspended_by      uuid REFERENCES public.profiles(id),
    suspended_reason  text,
    paused_at         timestamptz,
    paused_by         uuid REFERENCES public.profiles(id),
    paused_reason     text,
    deleted_at        timestamptz
);

CREATE INDEX idx_providers_status ON public.providers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_providers_slug ON public.providers(slug) WHERE deleted_at IS NULL;
```

#### `provider_memberships`

```sql
CREATE TABLE public.provider_memberships (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id   uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    role          provider_role NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_provider_memberships_user ON public.provider_memberships(user_id);
CREATE INDEX idx_provider_memberships_provider ON public.provider_memberships(provider_id);
```

#### `provider_service_areas`

```sql
CREATE TABLE public.provider_service_areas (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id       uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    country           text NOT NULL DEFAULT 'NO',
    city              text NOT NULL,
    postal_code_from  text NOT NULL,
    postal_code_to    text NOT NULL,
    min_employees     integer DEFAULT 20,
    max_employees     integer,
    available_days    text[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
    active            boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_areas_postal ON public.provider_service_areas(postal_code_from, postal_code_to);
CREATE INDEX idx_service_areas_active ON public.provider_service_areas(provider_id) WHERE active = true;
```

#### `audit_log`

```sql
CREATE TABLE public.audit_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      uuid REFERENCES public.profiles(id),
    action        text NOT NULL,        -- 'suspend' | 'pause' | 'delete' | 'resume' | 'create' | 'update'
    entity_type   text NOT NULL,        -- 'provider' | 'company' | 'user' | 'order' | 'agreement'
    entity_id     uuid NOT NULL,
    reason        text,
    metadata      jsonb DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
```

### 4.2 Nye enums

```sql
CREATE TYPE provider_status AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED', 'CLOSED');
CREATE TYPE provider_role AS ENUM ('provider_admin', 'provider_kitchen', 'provider_viewer');

-- Utvid eksisterende user_role enum
ALTER TYPE user_role ADD VALUE 'provider_admin';
ALTER TYPE user_role ADD VALUE 'provider_kitchen';
ALTER TYPE user_role ADD VALUE 'provider_viewer';
```

### 4.3 Eksisterende tabeller — utvidelser

```sql
-- companies
ALTER TABLE public.companies ADD COLUMN provider_id uuid REFERENCES public.providers(id);
ALTER TABLE public.companies ADD COLUMN logo_url text;
ALTER TABLE public.companies ADD COLUMN suspended_at timestamptz;
ALTER TABLE public.companies ADD COLUMN suspended_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.companies ADD COLUMN suspended_reason text;
ALTER TABLE public.companies ADD COLUMN paused_at timestamptz;
ALTER TABLE public.companies ADD COLUMN paused_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.companies ADD COLUMN paused_reason text;
ALTER TABLE public.companies ADD COLUMN deleted_at timestamptz;

-- agreements
ALTER TABLE public.agreements ADD COLUMN provider_id uuid REFERENCES public.providers(id);

-- orders
ALTER TABLE public.orders ADD COLUMN provider_id uuid REFERENCES public.providers(id);

-- company_registrations
ALTER TABLE public.company_registrations ADD COLUMN provider_id uuid REFERENCES public.providers(id);
ALTER TABLE public.company_registrations ADD COLUMN requested_postal_code text;
ALTER TABLE public.company_registrations ADD COLUMN requested_city text;

-- menu_service_days
ALTER TABLE public.menu_service_days ADD COLUMN provider_id uuid REFERENCES public.providers(id);

-- profiles (suspend/pause-felter)
ALTER TABLE public.profiles ADD COLUMN suspended_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN suspended_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN suspended_reason text;
ALTER TABLE public.profiles ADD COLUMN paused_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
```

### 4.4 ER-diagram (tekstuelt)

```
auth.users (id)
   ↓ 1:1
profiles (id, role[user_role], suspended_at, paused_at, deleted_at)
   ↓ 1:many
   ├─ company_memberships (user_id, company_id, role)
   ├─ location_memberships (user_id, location_id, role)
   └─ provider_memberships (user_id, provider_id, role) [NY]

providers (id, name, slug, status, logo_url, suspended_at, deleted_at) [NY]
   ↓ 1:many
   ├─ provider_memberships [NY]
   ├─ provider_service_areas [NY]
   ├─ companies (provider_id) [utvidet]
   ├─ agreements (provider_id) [utvidet]
   ├─ orders (provider_id) [utvidet]
   ├─ company_registrations (provider_id) [utvidet]
   └─ menu_service_days (provider_id) [utvidet]

companies (provider_id, logo_url, suspended_at, deleted_at) [utvidet]
   ↓ 1:many
   ├─ company_locations
   ├─ company_memberships (eksisterende)
   ├─ agreements
   └─ orders

audit_log (actor_id, action, entity_type, entity_id, reason, metadata) [NY]
   immutable, append-only
```

---

## 5. Roller og RBAC

### 5.1 user_role enum (utvidet)

| Rolle | Scope | Eksempel |
|---|---|---|
| `superadmin` | Platform-nivå | Lunchportalen-team |
| `provider_admin` | Provider-nivå (via memberships) | Daglig leder hos Melhus Catering |
| `provider_kitchen` | Provider-nivå (via memberships) | Kjøkkensjef hos Melhus |
| `provider_viewer` | Provider-nivå (via memberships) | Regnskap hos Melhus |
| `company_admin` | Company-nivå (via memberships) | HR-leder hos Acme |
| `employee` | Company-nivå (via memberships) | Ansatt hos Acme |
| `kitchen` | Location-nivå (eksisterende) | Lokasjons-kjøkkenpersonell |

### 5.2 Hybrid mønster (bekreftet i audit)

Lunchportalen bruker hybrid-mønster:
- `profiles.role` (user_role) er **primær rolle** — runtime-sannhet
- `*_memberships` viser hvilke entiteter (company, location, provider) brukeren har tilgang til
- En bruker kan ha flere memberships men én primær rolle

**Eksempel:** Jens er `provider_admin` på `profiles.role`. Han har provider_memberships til Melhus og Provider B (i fremtiden et nasjonalt firma). På company-nivå har han ingen tilgang.

### 5.3 RBAC-matrise (operasjons-tilgang)

| Operasjon | Platform Superadmin | Provider Admin | Provider Kitchen | Provider Viewer | Company Admin | Employee | Kitchen |
|---|---|---|---|---|---|---|---|
| Opprette provider | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Pause/suspend provider | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Godkjenne company-registrering | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Pause/suspend company | ✓ | ✓ (egne) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Slette company | ✓ | ✓ (egne) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Se alle ordrer (provider-scope) | ✓ | ✓ (egne) | ✓ (egne) | ✓ (egne) | ✗ | ✗ | ✗ |
| Kjøkken-dashboard | ✓ | ✓ (egne) | ✓ (egne) | ✗ | ✗ | ✗ | ✓ (location) |
| Eksport/fakturagrunnlag | ✓ | ✓ (egne) | ✗ | ✓ (egne) | ✗ | ✗ | ✗ |
| Endre meny (Sanity) | ✓ | ✓ (egne via Sanity Studio scoped) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Invitere ansatte til company | ✓ | ✗ | ✗ | ✗ | ✓ (eget firma) | ✗ | ✗ |
| Pause/suspend egne ansatte | ✓ | ✓ | ✗ | ✗ | ✓ (eget firma) | ✗ | ✗ |
| Slette egne ansatte | ✓ | ✓ | ✗ | ✗ | ✓ (eget firma, soft) | ✗ | ✗ |
| Bestille egen lunsj | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 6. Suspend / Pause / Delete-hierarki

### 6.1 Operasjons-typer

| Action | Effekt | Reversibel | Bruksområde |
|---|---|---|---|
| **PAUSE** | Midlertidig stopp. Bestillinger stopper, tilgang opprettholdes. | Ja, alltid | Ferie, kort betalingsproblem |
| **SUSPEND** | Tilgang revoked. Data beholdes. | Ja, via admin override | Manglende betaling, policy-brudd |
| **DELETE** | Soft delete. Hard delete etter 30 dager. | Innen 30 dager | Permanent kunde-utgang, GDPR |
| **RESUME** | Reaktiverer paused/suspended entity | n/a | Etter løst issue |

### 6.2 Hierarkisk autoritet

Hvert admin-nivå har makt **ned i hierarkiet**:

```
Platform Superadmin
   ↓ pause/suspend/delete
Provider Admin
   ↓ pause/suspend/delete
Company Admin
   ↓ pause/suspend/delete
Employee (ingen makt nedover)
```

**Praktiske scenarier:**

- **Provider Admin (Melhus) → suspend Company (Acme)** — Acme betaler ikke faktura
- **Company Admin (Acme) → suspend Employee (Per)** — Per har sluttet, men ikke offboarded ennå
- **Platform Superadmin → pause Provider (Melhus)** — Melhus avventer juridisk avklaring
- **Platform Superadmin → delete User** — GDPR right-to-erasure

### 6.3 Cascade-regler

Når en parent-entity suspenders, må barn håndteres konsistent:

| Parent-action | Cascade-effekt |
|---|---|
| Provider SUSPENDED | Alle companies på provider settes til suspended (provider-cascade flag). Ordrer pauses. Provider-memberships beholdes (admin-tilgang) men provider-funksjoner deaktiveres. |
| Provider DELETED | Cascade soft-delete på alle companies. 30-dagers recovery window. |
| Company SUSPENDED | Alle ordrer på company pauses. Company-memberships tilgang revoked. Employees kan logge inn men ikke bestille. |
| Company DELETED | Cascade soft-delete på orders (anonymisert for finansielle records). Employees beholder bruker men mister membership. |
| Employee SUSPENDED | Kan ikke bestille. Login OK for å se egen historikk. |
| Employee DELETED | Soft delete med 30-dagers grace. GDPR-trigger kan akselerere til hard delete. |

### 6.4 Audit-log (immutable)

Alle suspend/pause/delete/resume-actions logges i `audit_log`:

```sql
-- Eksempel: Provider Admin suspender Company
INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
VALUES (
    auth.uid(),
    'suspend',
    'company',
    'acme-uuid'::uuid,
    'Manglende betaling av faktura #12345, forfalt 30 dager',
    jsonb_build_object(
        'provider_id', 'melhus-uuid',
        'cascade_orders_paused', 47,
        'cascade_memberships_revoked', 23
    )
);
```

Audit-log policies:
- **INSERT:** authenticated kan logge (med actor_id = auth.uid())
- **SELECT:** kun is_platform_admin() ELLER can_access_provider(via metadata.provider_id)
- **UPDATE/DELETE:** kun service_role (i praksis aldri — log er immutable)

### 6.5 GDPR-overveielser

For Employee DELETE med GDPR-trigger:
- E-post i `auth.users` scrambles til `deleted-{uuid}@deleted.local`
- PII-felter i `profiles` nullified (full_name, phone)
- `profiles.deleted_at` settes, GDPR-flag i metadata
- `auth.users.banned_until` til år 9999 (kan ikke logge inn)
- Ordrer beholdes for finansielle records men anonymiseres (vises som "Tidligere ansatt")

### 6.6 RPC-funksjoner

Sentrale RPC-er som håndterer cascade + audit i én transaksjon:

```sql
-- Suspend a company (provider_admin or platform_admin)
CREATE OR REPLACE FUNCTION public.lp_company_suspend(
    p_company_id uuid,
    p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_provider_id uuid;
    v_cascade_orders int;
BEGIN
    -- Rolle-sjekk: provider_admin (av denne provideren) eller platform_admin
    SELECT provider_id INTO v_provider_id FROM companies WHERE id = p_company_id;
    IF NOT (can_access_provider(v_provider_id) OR is_platform_admin()) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;

    -- Suspend company
    UPDATE companies SET
        suspended_at = now(),
        suspended_by = auth.uid(),
        suspended_reason = p_reason
    WHERE id = p_company_id;

    -- Cascade: pause active orders
    UPDATE orders SET status = 'paused'
    WHERE company_id = p_company_id AND status = 'active';
    GET DIAGNOSTICS v_cascade_orders = ROW_COUNT;

    -- Audit
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
    VALUES (auth.uid(), 'suspend', 'company', p_company_id, p_reason,
            jsonb_build_object('cascade_orders_paused', v_cascade_orders));

    RETURN jsonb_build_object('ok', true, 'cascade_orders_paused', v_cascade_orders);
END;
$$;
```

Tilsvarende RPC-er: `lp_company_pause`, `lp_company_delete`, `lp_company_resume`, `lp_provider_suspend`, `lp_user_suspend`, osv.

---

## 7. RLS-strategi

### 7.1 can_access_provider() helper

```sql
CREATE OR REPLACE FUNCTION public.can_access_provider(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM provider_memberships
        WHERE user_id = auth.uid()
        AND provider_id = p_provider_id
    )
    OR is_platform_admin();
$$;
```

### 7.2 RLS-utvidelser (stegvis)

Eksisterende `can_access_company()` beholdes. Nye policies legger til provider-access som ADDITIV.

Eksempel: orders SELECT-policy etter utvidelse:

```sql
-- FØR (eksisterende):
CREATE POLICY orders_select ON public.orders
    FOR SELECT
    USING (
        can_access_company(company_id) OR is_platform_admin()
    );

-- ETTER (Phase E.6):
CREATE POLICY orders_select ON public.orders
    FOR SELECT
    USING (
        can_access_company(company_id)
        OR can_access_provider(provider_id)
        OR is_platform_admin()
    );
```

### 7.3 Rekkefølge for RLS-rollout

190 policies kan ikke oppdateres samtidig. Stegvis approach:

1. **Patch 6 (kjerne):** providers, provider_memberships, companies, agreements, orders, menu_service_days, company_registrations
2. **Patch 7 (suspend-aware):** legge til suspended_at-sjekk på SELECT-policies (skjuler suspended data utenfor admin)
3. **Patch 10-11 (operasjonelle):** company_memberships, location_memberships, company_locations, kitchen_views
4. **Patch 14+ (kompletteringspolicies):** resterende ~170 policies oppdateres som del av relaterte patches

### 7.4 Suspend-aware queries (Patch 7)

```sql
-- Vanlig bruker ser ikke suspended companies
CREATE POLICY companies_select_default ON public.companies
    FOR SELECT
    USING (
        (can_access_company(id) OR can_access_provider(provider_id))
        AND suspended_at IS NULL
        AND deleted_at IS NULL
    );

-- Admin-policy: kan se også suspended (for å gjenoppta)
CREATE POLICY companies_select_admin ON public.companies
    FOR SELECT
    USING (
        is_platform_admin()
        OR (can_access_provider(provider_id) AND deleted_at IS NULL)
    );
```

---

## 8. Sanity provider-scope

### 8.1 Nytt document type: `provider`

```typescript
defineType({
    name: 'provider',
    title: 'Provider',
    type: 'document',
    fields: [
        defineField({ name: 'slug', type: 'slug', validation: r => r.required() }),
        defineField({ name: 'name', type: 'string', validation: r => r.required() }),
        defineField({ name: 'supabaseId', type: 'string', readOnly: true, description: 'provider.id i Supabase (kanonisk)' }),
        defineField({ name: 'logo', type: 'image', options: { hotspot: true } }),
        defineField({ name: 'description', type: 'text' }),
        defineField({ name: 'colorPrimary', type: 'string', description: 'HEX-kode, brukes som branding' }),
    ]
});
```

### 8.2 menuDay utvidelse

```typescript
defineType({
    name: 'menuDay',
    type: 'document',
    fields: [
        defineField({
            name: 'providerRef',
            type: 'reference',
            to: [{ type: 'provider' }],
            validation: r => r.required(),
            description: 'Hvilken leverandør denne dagen tilhører'
        }),
        // ...eksisterende felter (date, plan_tier, categories, etc.)
    ]
});
```

### 8.3 productPlan (Patch 2.1-hull)

`productPlan` er fortsatt 2-tier per audit. Patch 2.1 utvider til 3-tier (basis/luxus/enterprise). **Ingen provider-scope på productPlan** — plan-tier er kanonisk på tvers av providers (Basis = Basis uansett provider).

### 8.4 Content migration (Patch 12)

Sanity content-script som:
1. Oppretter Sanity-dokument for default provider (`provider-melhus-catering`)
2. Setter `providerRef` på alle eksisterende menuDay-dokumenter til default provider
3. Migrasjon kan kjøres en gang per environment (dev → staging → prod)

```typescript
// scripts/sanity/migrate-providers-v1.ts
async function migrate() {
    // 1. Opprett default provider
    const defaultProvider = await client.create({
        _type: 'provider',
        slug: { _type: 'slug', current: 'melhus-catering' },
        name: 'Melhus Catering AS',
        supabaseId: process.env.MELHUS_SUPABASE_ID,
    });

    // 2. Backfill menuDay
    const menuDays = await client.fetch(`*[_type == "menuDay" && !defined(providerRef)]`);
    for (const day of menuDays) {
        await client.patch(day._id)
            .set({ providerRef: { _type: 'reference', _ref: defaultProvider._id } })
            .commit();
    }
}
```

### 8.5 GROQ-queries scoped per provider

Etter migration, queries scopes per provider:

```typescript
const menuQuery = groq`
    *[_type == "menuDay"
      && providerRef->supabaseId == $providerId
      && date >= $weekStart
      && date <= $weekEnd]
`;
```

---

## 9. UI-arkitektur

### 9.1 Route-grupper

```
app/
├── (app)/                     # Eksisterende employee/company-admin
│   ├── week/
│   ├── kitchen/               # location-scoped kitchen (eksisterende kitchen-rolle)
│   └── ...
├── superadmin/                # Eksisterende platform-superadmin
│   ├── companies/
│   ├── agreements/
│   └── providers/             # NY: provider-administrasjon
├── leverandor/                # NY: provider-admin shell
│   ├── dashboard/             # Provider-oversikt
│   ├── kunder/                # Companies under provider
│   ├── ansatte/               # Provider's team (provider_memberships)
│   ├── meny/                  # Sanity meny scoped per provider
│   ├── kjokken/               # Kitchen-view scoped to provider
│   ├── bestillinger/          # Orders scoped to provider
│   ├── avtaler/               # Agreements (incl. pending registrations)
│   ├── omrader/               # provider_service_areas management
│   ├── innstillinger/         # Provider settings (logo, hours, branding)
│   └── audit/                 # Audit log for provider's actions
└── registrering/              # Eksisterende, utvides for provider-matching
    ├── page.tsx               # Hovedflyt (område → match → submit)
    └── [providerSlug]/        # Provider-låst lenke
```

### 9.2 Provider-admin dashboard (`/leverandor/dashboard`)

Layout (mobile-first per Lunchportalen-instruks):

```
┌─────────────────────────────────┐
│ Melhus Catering AS — Dashboard  │
├─────────────────────────────────┤
│ Nye forespørsler: 3              │  ← lenke til /leverandor/avtaler?status=pending
│ Aktive kunder: 12                │
│ Bestillinger i dag: 247          │
│ Kommende uke: 1234               │
├─────────────────────────────────┤
│ [Kjøkken-oversikt i dag]         │  ← embed av /leverandor/kjokken
├─────────────────────────────────┤
│ [Siste audit-events: 5]          │
└─────────────────────────────────┘
```

### 9.3 Suspend/Pause/Delete UI

Konsistent UI-pattern per nivå:

```
[Entity-detalj-side]
├── ⋯ Handlingsmeny (dropdown)
│   ├── 🔵 Pause midlertidig
│   ├── 🟡 Suspender
│   ├── 🔴 Slett (krever bekreftelse)
│   └── 📋 Vis audit log
├── Hvis suspended:
│   ├── ⚠️ Banner: "Suspended av [actor] [tidspunkt] — [reason]"
│   └── 🟢 Gjenoppta-knapp (rolle-betinget)
└── Hvis deleted:
    ├── 🗑️ Banner: "Slettet [tidspunkt] — kan gjenopprettes i 30 dager"
    └── 🟢 Gjenopprett-knapp (rolle-betinget)
```

Suspend/Delete-handlinger må ha:
- Påkrevd reason-tekst (min 20 tegn)
- Bekreftelses-modal som viser cascade-impact ("Dette vil suspende 12 ordrer")
- Audit-link til ny audit-event etter operasjon

### 9.4 Provider logo + branding

Provider-admin laster opp logo via `/leverandor/innstillinger`:
- Format: PNG/SVG, max 2 MB, anbefalt 512×512
- Storage: Supabase Storage bucket `provider-logos`
- URL lagres i `providers.logo_url`
- Vises på: provider-kort i registrering, kjøkken-dashboard header, fakturagrunnlag

Company-admin laster opp logo via `/admin/firma/innstillinger`:
- Lagres i `companies.logo_url`
- Vises på: interne firma-sider, ordrekvittering, intern fakturagrunnlag

### 9.5 Klasser & tokens

Per Lunchportalen-instruks: bruk eksisterende `ds-*` og `lp-*` klasser. Nye komponenter for provider-shell:

- `.ds-suspend-banner` — suspended-status banner (gul/rød)
- `.ds-audit-entry` — én audit-log-rad
- `.ds-cascade-warning` — bekreftelses-modal warning
- `.ds-provider-card` — provider-kort på registreringsskjerm

Hvis nye klasser kreves: utvid `design-system.css`. Hvis det er provider-spesifikke landing-komponenter: utvid `landing-page-blocks.css` (per hardregel om hvor klasser legges).

---

## 10. Migration-strategi

### 10.1 Utgangspunkt (per audit)

| Miljø | Tilstand |
|---|---|
| Staging | Tom etter B4.2.1-wipe (0/0/0/0/0/0) |
| Prod | 9 firma, 19 profiler, 5 BASIS-avtaler. **billing_products mangler.** Ingen Luxus/Enterprise-data. |

### 10.2 Forward-only migration

Strategi: opprett Melhus som default provider, backfill `provider_id` på eksisterende data.

```sql
-- Phase E.5 (Patch 5): backfill-script

-- 1. Opprett Melhus i providers-tabellen (deterministic UUID for repeatability)
INSERT INTO public.providers (id, name, slug, contact_email, status, billing_model)
VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,  -- deterministic
    'Melhus Catering AS',
    'melhus-catering',
    'kontakt@melhuscatering.no',
    'ACTIVE',
    'SAAS_FIXED'
);

-- 2. Opprett service area for Trondheim
INSERT INTO public.provider_service_areas (provider_id, city, postal_code_from, postal_code_to)
VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Trondheim',
    '7000',
    '7099'
);

-- 3. Backfill eksisterende data
UPDATE public.companies              SET provider_id = '11111111-1111-1111-1111-111111111111' WHERE provider_id IS NULL;
UPDATE public.agreements             SET provider_id = '11111111-1111-1111-1111-111111111111' WHERE provider_id IS NULL;
UPDATE public.orders                 SET provider_id = '11111111-1111-1111-1111-111111111111' WHERE provider_id IS NULL;
UPDATE public.company_registrations  SET provider_id = '11111111-1111-1111-1111-111111111111' WHERE provider_id IS NULL;
UPDATE public.menu_service_days      SET provider_id = '11111111-1111-1111-1111-111111111111' WHERE provider_id IS NULL;

-- 4. Verifiser ingen NULL
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM companies WHERE provider_id IS NULL) THEN
        RAISE EXCEPTION 'companies has NULL provider_id after backfill';
    END IF;
    -- ...repeat for andre tabeller
END $$;

-- 5. Sett NOT NULL constraints
ALTER TABLE public.companies              ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.agreements             ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.orders                 ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.menu_service_days      ALTER COLUMN provider_id SET NOT NULL;
-- company_registrations beholdes NULLable inntil provider-matching er på plass (Patch 13)
```

### 10.3 Rollback-plan

Hver migration har DOWN-script (per supabase migrations-pattern):

```sql
-- DOWN: rollback provider_id
ALTER TABLE public.companies DROP COLUMN provider_id;
ALTER TABLE public.agreements DROP COLUMN provider_id;
-- ...etc
DROP TABLE public.providers CASCADE;
```

DOWN-scripts kjøres aldri i prod, men beholdes for staging-recovery hvis Patch 5 viser seg å være feil.

### 10.4 Sanity content migration

Egen migration-script (Patch 12). Idempotent — kan kjøres flere ganger uten effekt på allerede-migrerte dokumenter.

```typescript
// Kun migrate menuDay som mangler providerRef
const unmigratedMenuDays = await client.fetch(
    `*[_type == "menuDay" && !defined(providerRef)]`
);
```

---

## 11. Patch-sekvens 2.2 → 15

### Patch 2.1 — Enterprise-hull (planlagt før Phase E)
**Status:** Klar til kjøring (egen prompt eksisterer)
**Scope:** lib/tripletex/client.ts, agreement-detail-client, week/page, OnboardingForm, Sanity productPlan
**Acceptance:** typecheck PASS, ingen 2-tier-antagelser igjen, fail-closed billing

### Patch 2.2 — billing_products migration til prod
**Scope:** Apply eksisterende billing_products-migrasjon til prod (audit-funn: mangler)
**Filer:** ingen kodendring, kun migration runner
**Acceptance:** billing_products eksisterer i prod med BASIS+LUXUS rader, ENTERPRISE NOT_CONFIGURED guard active
**Estimat:** < 1 dag

### Patch 3 — Provider domain type (read-only)
**Scope:** TypeScript types + repository interface uten implementasjon
**Filer:**
- `lib/providers/types.ts` (Provider, ProviderRole, ProviderStatus, ServiceArea)
- `lib/providers/repository.ts` (interface only)
- `tests/lib/providers/types.test.ts`
**Acceptance:** typecheck PASS, type guards med 100% coverage
**Estimat:** 1 dag

### Patch 4 — Provider database schema
**Scope:** Migration for 4 nye tabeller + enums + utvidet user_role
**Filer:**
- `supabase/migrations/{timestamp}_provider_core_schema.sql`
- `supabase/migrations/{timestamp}_provider_core_rls_baseline.sql`
**Acceptance:** migration applies clean til staging, alle eksisterende tester fortsatt PASS, baseline RLS aktiv (deny by default for unauthenticated)
**Estimat:** 2-3 dager

### Patch 5 — provider_id på eksisterende tabeller + backfill
**Scope:** ADD COLUMN provider_id + Melhus default provider + backfill + NOT NULL
**Filer:**
- `supabase/migrations/{timestamp}_provider_id_on_existing_tables.sql`
- `supabase/migrations/{timestamp}_seed_default_provider_melhus.sql`
**Acceptance:** alle rader i companies/agreements/orders/menu_service_days har provider_id, NOT NULL enforced
**Estimat:** 1-2 dager

### Patch 6 — RLS provider helpers + kjerne-policies
**Scope:** can_access_provider() helper + utvide RLS på 7 kjerne-tabeller
**Filer:**
- `supabase/migrations/{timestamp}_provider_rls_helpers.sql`
- `supabase/migrations/{timestamp}_provider_rls_core_policies.sql`
**Acceptance:** integration-tests for provider-scoped queries PASS, eksisterende company-scope-tester fortsatt PASS
**Estimat:** 3-5 dager

### Patch 7 — Suspend/Pause/Delete-infrastruktur
**Scope:** audit_log table + suspend RPC-er + cascade-triggers
**Filer:**
- `supabase/migrations/{timestamp}_audit_log_table.sql`
- `supabase/migrations/{timestamp}_suspend_rpc_functions.sql`
- `lib/admin/suspend.ts` (TypeScript helpers)
**Acceptance:** unit + integration tests for alle suspend-scenarier inkl. cascade, audit log immutable
**Estimat:** 3-4 dager

### Patch 8 — Provider Admin auth & helpers
**Scope:** requireProviderRole, mustProviderId, server actions
**Filer:**
- `lib/auth/provider.ts`
- `lib/auth/withProviderRole.ts`
- `tests/lib/auth/provider.test.ts`
**Acceptance:** typecheck + integration-tests for alle auth-helpers
**Estimat:** 2 dager

### Patch 9 — Provider Admin UI shell
**Scope:** `/leverandor` route group, layout, navigation, dashboard (statisk)
**Filer:**
- `app/leverandor/layout.tsx`
- `app/leverandor/dashboard/page.tsx`
- `components/leverandor/Navigation.tsx`
**Acceptance:** Storybook stories + visuell review, klasser per design-system
**Estimat:** 3-4 dager

### Patch 10 — Provider Customers (companies management)
**Scope:** `/leverandor/kunder` med liste, filter, suspend/pause/delete-actions wired
**Filer:**
- `app/leverandor/kunder/page.tsx`
- `app/leverandor/kunder/[id]/page.tsx`
- `components/leverandor/CompanyList.tsx`
- `components/leverandor/SuspendDialog.tsx`
**Acceptance:** e2e tests for hver action, audit-trail UI viser nye events
**Estimat:** 4-5 dager

### Patch 11 — Provider Kitchen scope
**Scope:** Utvide eksisterende kitchen-views til å filtrere på provider_id når bruker er provider_kitchen
**Filer:**
- `lib/kitchen/kitchenFetch.ts` (utvide for provider-scope)
- `app/leverandor/kjokken/page.tsx`
**Acceptance:** kitchen UI fungerer for både kitchen-rolle (location-scoped) og provider_kitchen (provider-scoped), ingen regresjon
**Estimat:** 2-3 dager

### Patch 12 — Sanity provider schema + migration
**Scope:** Sanity provider document type + menuDay providerRef + content migration script
**Filer:**
- `sanity/schemas/provider.ts`
- `sanity/schemas/menuDay.ts` (utvide)
- `scripts/sanity/migrate-providers-v1.ts`
**Acceptance:** Sanity studio viser provider-felt, queries scopes per provider, eksisterende menuDay backfilled
**Estimat:** 2-3 dager

### Patch 13 — Registreringsflyt med provider-matching
**Scope:** `/registrering` flyten utvides — postal_code → match providers
**Filer:**
- `components/auth/CompanyRegistrationForm.tsx` (major refactor)
- `app/registrering/page.tsx`
- `app/registrering/[providerSlug]/page.tsx` (NY: provider-låst variant)
- `app/api/registrering/match-providers/route.ts` (NY API-endpoint)
- `lib/providers/matchByPostalCode.ts`
**Acceptance:** e2e tests for 4 scenarioer:
  - 1 provider match: auto-select
  - flere matches: card selection UI
  - 0 matches: venteliste-flow
  - provider-låst URL: leverandør forhåndsvalgt
**Estimat:** 4-5 dager

### Patch 14 — Provider service areas + admin UI
**Scope:** Provider admin kan editere egne service_areas via `/leverandor/omrader`
**Filer:**
- `app/leverandor/omrader/page.tsx`
- `components/leverandor/ServiceAreaEditor.tsx`
**Acceptance:** e2e for matching-algoritme, validering av postal-range, audit-log på endringer
**Estimat:** 2-3 dager

### Patch 15 — Provider billing & SaaS-lisens
**Scope:** billing_products: SaaS-lisens per provider + Tripletex provider-side mapping
**Filer:**
- `supabase/migrations/{timestamp}_billing_products_provider_saas.sql`
- `lib/integrations/tripletex/provider-billing.ts`
- `app/api/system/outbox/process/route.ts` (utvide for provider-billing)
**Acceptance:** end-to-end fakturaflyt: Lunchportalen → Melhus → faktura via Tripletex
**Estimat:** 4-5 dager

### Total estimat

| Estimat | Dager | Uker fokusert (5 dager/uke) |
|---|---|---|
| Best-case | 28 dager | 5.6 uker |
| Realistisk | 38 dager | 7.6 uker |
| Pessimistisk | 50 dager | 10 uker |

**Mid-point: ~7-8 uker fokusert arbeid for Phase E komplett.**

---

## 12. Risk-matrise

| # | Risiko | Alvorlighet | Sannsynlighet | Mitigation |
|---|---|---|---|---|
| 1 | RLS-omfang (190 policies) krever lengre tid enn estimert | Høy | Medium | Stegvis (kjerne først), automated regression tests, mulig parallell RLS-rydding etter Phase E |
| 2 | billing_products mangler i prod blokkerer Enterprise-fakturering | Høy | Lav | Patch 2.2 lukker hullet med egen migration |
| 3 | Sanity content migration feiler / inconsistent | Medium | Medium | Idempotent script + dry-run mode + manual review før prod-kjøring |
| 4 | Dual profile/membership sync trigger breaks ved utvidelse | Medium | Lav | Utvid eksisterende trigger conservativt, integration-test før deploy |
| 5 | Cascade suspend skaper utilsiktet data-tap | Høy | Lav | Comprehensive test-suite med fixtures, alle cascade-actions er audited, soft-delete med recovery |
| 6 | User confusion: provider_admin vs company_admin | Lav | Medium | Klare navigation labels, separate route groups, dokumentasjon i UI |
| 7 | GDPR right-to-erasure i cascade krever spesial-handling | Medium | Medium | Eksplisitt GDPR-path som overstyrer 30-dagers grace, dokumentert i Patch 7 |
| 8 | Patch 13 (registrering-flow) UI-revisjon underestimert | Medium | Medium | Tidlig prototype + brukerintervju med Melhus før implementering |
| 9 | Migration backfill feiler i prod (FK-konflikter) | Høy | Lav | Test 5× i staging med prod-data-kopi, pre-flight integrity checks |
| 10 | Tripletex Enterprise produktmapping krever ekstern avklaring | Medium | Høy | Behold fail-closed til Patch 15, ikke blokker Phase E |

---

## 13. Testing-strategi

### 13.1 Per patch

Hver patch må passere:
- `npm run typecheck` — alltid
- `npm run lint` — alltid
- `npm run test:run` — alle unit + integration tests
- Patch-spesifikke tester (tilført i samme patch)

### 13.2 Migration-spesifikt

Database-patches (4, 5, 6, 7, 12, 15) krever:
- Apply migration til staging med tom DB
- Apply migration til staging med B4.2.1-baseline data
- Apply migration til staging-clone-of-prod (9 firma)
- Verifiser ingen regresjon i eksisterende tester
- Verifiser nye patch-tester PASS

### 13.3 RLS-tester (vitest + Supabase)

Hver RLS-utvidelse må ha integration-tester for:
- Provider Admin på Provider A kan se sine data
- Provider Admin på Provider A kan IKKE se Provider B's data
- Platform Superadmin kan se alle providers' data
- Anonymous user får `permission denied` på alt
- Suspended company er ikke synlig for ordinære queries

### 13.4 E2E-tester (Playwright)

UI-patches (9, 10, 13, 14) krever Playwright-scenarier:
- Provider Admin login → ser kun egne kunder
- Provider Admin suspender Company → cascade-effekter synlige i UI
- Company Admin invitérer ansatt → ansatt får tilgang scoped til company
- Public registreringsflyt → provider-matching basert på postnummer

### 13.5 Post-Phase E

Etter Patch 15 lukket:
- **Full B4.2.2 re-skalering** på provider-scope:
  - 10-100 providers × 100 firma × 100 brukere = 100K-1M brukere
  - Prod-realistisk arkitektur
  - Bekrefte at B4.2.1 throughput-baselines holder med provider-RLS
- **Performance-regresjon vs B4.2.1:** RLS-overhead per query må være < 20% mer enn pre-provider

### 13.6 Regresjons-sjekk for B4-arbeid

Alle B4.2.1-acceptance må fortsatt PASS etter Phase E:
- Determinisme: first10_hash uendret (provider-data backfilled gir nye hashes — ny baseline)
- Seed-infrastruktur fortsatt funksjonell
- 100K seed fortsatt mulig under én provider (sanity check)

---

## 14. Phase F outline (Recipe & Margin Engine)

**Status:** Konsept (etter Phase E komplett)
**Estimat:** 8-15 patches over 6-10 uker

### 14.1 Forretningskrav

Per brukerens svar #5:

> "Er det 90,- eks mva så skal systemet selv sikre at det blir gevinst."

Systemet skal automatisk sikre margin per måltid uten at kjøkken må regne manuelt.

### 14.2 Datamodell (utkast)

```
ingredients
  - id, name, supplier, unit_cost_nok, unit_size, allergens

recipes
  - id, name, plan_tier, provider_id (scoped per provider)
  - servings, prep_time_min

recipe_ingredients
  - recipe_id, ingredient_id, amount, unit

margin_targets
  - provider_id, plan_tier, target_margin_pct (e.g. 40%)

meal_plans
  - menu_day_id, recipes[], total_cost, total_revenue, actual_margin_pct
```

### 14.3 Komponenter

- **Ingredient catalog** — råvarekost-DB, oppdateres ved leveranse
- **Recipe builder** — kjøkken bygger oppskrifter, system beregner kost
- **Margin validator** — system avviser/varsler hvis margin < target
- **Meal planner** — foreslår retter for uka som maksimerer margin gitt plan_tier-pris
- **Kitchen dashboard** — viser margin per dag, varslar hvis under target

### 14.4 Integrasjon

Recipe & Margin Engine er **provider-scoped**:
- Hver provider har egne ingredients + recipes
- Margin-targets settes per provider per plan_tier
- meal_plans kobles til provider_id + menu_day_id (Sanity)

### 14.5 Patch-rekkefølge (utkast)

1. Ingredient catalog (DB + UI)
2. Recipe builder (DB + UI)
3. Margin calculator (kjernelogikk)
4. Margin validator (integrert i Sanity meal publish)
5. Meal planner (anbefaling-engine)
6. Kitchen dashboard utvidelse
7. Reports + analytics
8. ML/auto-suggestions (langt frem)

---

## 15. Open Questions

For senere avklaring (kan ventes til Patch 9-15):

1. **Provider logo: vises på fakturagrunnlag?** Forutsatt: ja
2. **Provider beskrivelse: vises på registreringsflyt?** Forutsatt: ja
3. **Default colors per provider: hardkodet eller editable?** Forutsatt: editable via `providers.primary_color`
4. **Multi-language:** EN/NO? Forutsatt: NO only initially
5. **Cross-provider employee:** kan en bruker være ansatt hos to firma med ulik provider? Forutsatt: ja, via to memberships
6. **Provider-til-provider migration:** hvis Acme bytter fra Melhus til konkurrent? Forutsatt: cancel agreement med Melhus, ny avtale med konkurrent. Manual process i Phase E.
7. **Pris per tier:** når besluttes Basis/Luxus/Enterprise-pris? Per provider, eller globalt? Forutsatt: per provider (settes i provider_plans)
8. **SaaS-lisens beløp:** 990 kr/mnd er placeholder — endelig pris?
9. **Provider-onboarding:** manuelt for Phase E (Lunchportalen-team oppretter), self-service i Phase F+
10. **Audit log retention:** hvor lenge beholdes log-entries? Forutsatt: 3 år (kan slettes via separat compliance-prosess)

---

## Appendix A — Endrings-summary fra dagens arkitektur

| Område | I dag | Etter Phase E |
|---|---|---|
| Antall providers | 1 (implisitt) | N (eksplisitt, starter med Melhus) |
| Tabeller med tenant-scope | `companies` only | `providers`, `companies`, agreements/orders/etc med `provider_id` |
| Roller på `profiles.role` | superadmin, company_admin, employee, kitchen | + provider_admin, provider_kitchen, provider_viewer |
| Memberships-tabeller | 2 (company, location) | 3 (+ provider_memberships) |
| Suspend/delete | Ad-hoc | Strukturert med audit + cascade |
| Sanity scope | Global menyer | Provider-scoped menyer |
| Registreringsflyt | Generic | Område → provider-matching |
| UI route-grupper | (app), superadmin | + leverandor |

---

## Appendix B — Sannhetskilder

Alle Phase E-beslutninger refererer til:
- `scripts/audit/provider-audit-v1.md` — kartlegging av nåværende arkitektur
- `docs/architecture/provider-plan-v1.md` — DETTE DOKUMENT, master-plan
- Per-patch acceptance-rapporter (commits 59+)

Dokumentet versjoneres. V2/V3 oppdateres ved store endringer i scope.

---

**Status:** DRAFT V1 — klar for review
**Neste handling:** review + diskusjon → V1 final → Patch 2.1 + 2.2 start
**Forventet revisjon:** etter Patch 3-4 erfaring (justerer patch-sekvens 5-15)
