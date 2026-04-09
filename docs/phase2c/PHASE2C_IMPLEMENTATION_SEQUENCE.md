# Phase 2C — Foreslått implementasjonsrekkefølge

**Mål:** Realisere operative control towers **uten** å bryte eksisterende sannheter. **2C0** er kun plan; ingen rekkefølge her er implementasjon.

## Anbefalt rekkefølge (mål fra brief)

1. **Company admin**  
2. **Kitchen**  
3. **Driver**  
4. **Superadmin**

## Begrunnelse

| Rekkefølge | Hvorfor |
|------------|---------|
| **1. Company admin** | Størst direkte B2B-verdi; scope er **tenant** (`company_id`), lavere blast radius enn global superadmin; mange ruter/API finnes allerede — tower = **samling, IA, KPI-sannhet**, ikke nødvendigvis ny backend. |
| **2. Kitchen** | AGENTS S3: **read-only** — begrenser mutasjonsrisiko; `GET /api/kitchen` gir allerede produksjonsliste; tower = **klar operativ skjerm** + eventuelt rapport/eksport. |
| **3. Driver** | Mobilfelt; `confirm` er **begrenset** (kun i dag for sjåfør) — mindre flate enn superadmin; avhengig av stabil ordre-sannhet (ikke endre i tower). |
| **4. Superadmin** | **Høyest risiko**: pending/godkjenning, selskaper, brukere, stenging — berører onboarding og frosne livsløp; **kjøres sist** når mønstre fra tenant-flater er bevist. |

## Når repoet ville antyde annen rekkefølge

- Hvis **drift-krise** prioriteres: midlertidig **read-only** superadmin-dashboard (kun `/superadmin/system`, `/superadmin/overview`) **uten** mutasjoner — fortsatt ikke «full tower» før kjernen er trygg.  
- Hvis **felt** er kritisk: løft **Driver** før Kitchen — **kun** dersom produkt eksplisitt krever det; ellers behold rekkefølgen over for å minimere risiko (kitchen er enklere read-path).

## Foreslåtte del-faser (innhold, ikke startet)

| Fase | Innhold | Risiko |
|------|---------|--------|
| **2C1** | Company admin: én tower-IA (nav + dashboard + kontrolltårn-kobling), konsistente lenker til ansatte/lokasjoner/ordre/avtale; **ingen** ny billing | Lav–middels |
| **2C2** | Kitchen: én produksjonsvisning + eksport; batch kun etter review | Lav (lesing) |
| **2C3** | Driver: mobil polish + bekreftelsesflyt hardet med tester | Middels |
| **2C4** | Superadmin: operativ kjerne (firma, avtaler, godkjenning) med audit; **ikke** utvid `control-tower/*` uten spec | Høy |
| **2C+** | Binding/cron/påminnelse — egen leveranse | Høy |

## Avhengigheter

- **2C1** bør **ikke** blokkere på superadmin — men **må** respektere samme API-kontrakter.  
- **Cron** (3 mnd) avhenger av **avklart** felt for bindingstid — kan ikke startes i UI-only.
