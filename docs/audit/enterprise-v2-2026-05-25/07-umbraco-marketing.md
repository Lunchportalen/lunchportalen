# Fase G — Umbraco marketing + cross-cutting compliance

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Metode:** READ-ONLY · `umbraco17/` source + prod curl VOC · cross-ref Fase F LYVENDE  
**Status:** SUB G.1–G.6 **COMPLETE** → STOP-PUNKT G

**Artifacts:**

- `.tmp/umbraco-headers-voc.txt` — prod header + route matrix
- v1 carry: `archive/audit-v1-shallow/03-devops.md` §3.8 **F3-04**
- Fase B: [02-monorepo-anatomi.md §B.3](./02-monorepo-anatomi.md) Umbraco/ vs umbraco17/

---

## Coverage-ledger (Fase G)

| Sub | Scope | Filer / probes | Coverage |
| --- | --- | --- | ---: |
| **G.1** | Prod versjon + Umbraco/ vs umbraco17/ | csproj, workflow, git ls-files | 100% |
| **G.2** | Security headers VOC (F3-04 re-verify) | 12 prod curls | 100% |
| **G.3** | Members / backoffice / 2FA | Program.cs, appsettings, prod `/umbraco/*` | 100% |
| **G.4** | SEO (SeoToolkit + meta + robots/sitemap) | _Layout.cshtml, wwwroot, prod | 100% |
| **G.5** | F-LYV × Umbraco + SOC2/DATA_GOV PII | 7 LYVENDE + Tier 1/2 docs | 100% |
| **G.6** | Public surface / forms / skip-auth analogue | Views forms, prod routes | 100% |

---

# SUB G.1 — Prod versjon & monorepo sannhet

## G.1.1 Hva serverer prod?

| Spørsmål | Svar | Evidens |
| --- | --- | --- |
| Prod marketing host | `https://lunchportalen.no` | `appsettings.Production.json` L6 · prod curl `Server: Microsoft-IIS/10.0` |
| Kilde i repo | **`umbraco17/lunchportalen/`** | `.github/workflows/main_lunchportalen-umbraco.yml` L2–3, L21 |
| Umbraco versjon | **17.3.4** | `Directory.Packages.props` L8 |
| .NET | **net10.0** | `lunchportalen.csproj` L4 |
| Azure target | `lunchportalen-umbraco` | workflow L23 |
| App SaaS host | `app.lunchportalen.no` (Next.js/Vercel) | Fase D/E |

## G.1.2 Umbraco/ vs umbraco17/

| | `Umbraco/` (root) | `umbraco17/lunchportalen/` |
| --- | --- | --- |
| Git tracked | **0 filer** | **95 filer** |
| Innhold | Lokal `bin/`/`obj/` residue (dir finnes) | Full CMS: Program.cs, 72 Views, wwwroot, appsettings |
| Deploy | **Nei** | **Ja** — Azure workflow |
| Prod | — | **lunchportalen.no** |

**Konklusjon (uendret fra Fase B):** **`umbraco17` = prod.** Root `Umbraco/` er død build-artefakt — ikke DD-relevant som second stack.

## G.1.3 Kodeomfang

| Metrikk | Verdi |
| --- | --- |
| C# source (custom) | **1 fil** — `Program.cs` (standard Umbraco bootstrap) |
| Razor views | **72** `.cshtml` |
| Composers / SurfaceControllers | **0** i repo |
| NuGet | `Umbraco.Cms` 17.3.4, `SeoToolkit.Umbraco` 6.2.2 + Sitemap 6.2.1 |

**Implikasjon:** Marketing er **view-layer + CMS content i DB** — ingen custom server-side form handlers i git.

---

# SUB G.2 — Security audit (headers VOC)

**Metode:** `curl.exe -sI` mot prod · 2026-05-25 · artifact `.tmp/umbraco-headers-voc.txt`

## G.2.1 F3-04 re-verify — **BEKREFTET & FORSTERKET**

v1 **F3-04 P1:** `lunchportalen.no` mangler HSTS/CSP/X-Frame på Umbraco/Azure.

| Route | Status | HSTS | CSP | X-Frame | X-Content-Type | Referrer | Server / leak |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 200 | ✗ | ✗ | ✗ | ✗ | ✗ | IIS + **X-Powered-By: ASP.NET** |
| `/demo/` | 200 | ✗ | ✗ | **SAMEORIGIN** | ✗ | ✗ | Antiforgery cookie ✓ |
| `/priser/` | 200 | ✗ | ✗ | ✗ | ✗ | ✗ | ASP.NET |
| `/kontakt/` | **500** | ✗ | ✗ | ✗ | ✗ | ✗ | ASP.NET |
| `/umbraco/login` | 200 | ✗ | ✗ | ✗ | ✗ | ✗ | **Backoffice login exposed** |
| `http://` → HTTPS | 301 | — | — | — | — | — | ✓ redirect |

**Sammenligning app vs marketing:**

| Host | HSTS | CSP | OWASP gap |
| --- | --- | --- | --- |
| `app.lunchportalen.no` | ✓ (Vercel) | ✗ (**E-HDR-01**) | App bedre på transport, lik CSP-gap |
| `lunchportalen.no` | **✗** | **✗** | **Strengere DD-gap** — public marketing uten HSTS-header |

| ID | Sev | Funn |
| --- | --- | --- |
| **G-HDR-01** | **P1** | **F3-04 bekreftet** — Umbraco/Azure marketing uten HSTS/CSP/X-Frame (re-verify 2026-05-25) |
| G-HDR-02 | P2 | `X-Powered-By: ASP.NET` + `Server: Microsoft-IIS/10.0` on all responses |
| G-HDR-03 | P2 | Inconsistent X-Frame-Options (kun `/demo/`) |

---

# SUB G.3 — Members, backoffice, 2FA

## G.3.1 Program bootstrap

```csharp
builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddComposers()
```

| Feature | I repo? | Prod |
| --- | --- | --- |
| **Members** (public login) | **Nei** — ingen `.AddMembers()` | Ingen member area |
| **Backoffice** | **Ja** — standard Umbraco | `/umbraco/login` → **200** |
| **Delivery API** | Ikke konfigurert eksplisitt | `/umbraco/delivery/api/v2/content` → **404** |
| **Management API** | Default | `/umbraco/management/api/v1/server/information` → **404** |
| **External login / SSO** | Ingen config | — |
| **2FA / MFA** | Ingen `appsettings` eller composer | **Ikke evidert** — default Umbraco password only |

## G.3.2 Backoffice URL (DD)

| URL | Status | Obfuskert? |
| --- | --- | --- |
| `https://lunchportalen.no/umbraco` | **404** | Delvis — root path hidden |
| `https://lunchportalen.no/umbraco/login` | **200** | **Nei — standard Umbraco path** |
| `https://app.lunchportalen.no/umbraco/login` | **200** | Vercel **proxy** (`next.config.ts` L58–59) — samme login, **HSTS fra Vercel** |

**Security settings (`appsettings.json`):**

- `AllowConcurrentLogins: false` ✓
- `UpgradeUnattended: true` — unattended upgrade enabled (ops note)

| ID | Sev | Funn |
| --- | --- | --- |
| G-BO-01 | **P2** | Backoffice på **standard** `/umbraco/login` på **public marketing domain** — DD alarm |
| G-BO-02 | P2 | Vercel proxy lekker **Azure Web App hostname** i `Set-Cookie` Domain (`*.azurewebsites.net`) |
| G-SEC-01 | P2 | `Imaging.HMACSecretKey` **hardcoded** i tracked `appsettings.json` L39 — roter + flytt til secret store |

---

# SUB G.4 — SEO-config

## G.4.1 Pakker & on-page

| Lag | Implementering |
| --- | --- |
| NuGet | SeoToolkit.Umbraco + Sitemap 6.2.1 |
| `_Layout.cshtml` | `title`, `description`, `canonical` → **`https://www.lunchportalen.no`**, Open Graph, Twitter |
| JSON-LD | Per page (e.g. `demoPage.cshtml`, `pricing.cshtml`) |
| `wwwroot/robots.txt` | `Allow: /` + sitemap URL |
| Prod `robots.txt` | Begge apex + www sitemap linjer |
| Prod `sitemap.xml` | **200** `application/xml` |

## G.4.2 Split-domain SEO (Next vs Umbraco)

| Host | robots | SEO rolle |
| --- | --- | --- |
| `lunchportalen.no` | Allow all + sitemap | **Kanonisk marketing** |
| `app.lunchportalen.no` | `disallow: /` (`app/robots.ts`) | App ikke indeksert ✓ |

## G.4.3 SEO / legal route gaps (prod)

| Path | Prod status | Next redirect target |
| --- | --- | --- |
| `/kontakt/` | **500** | `next.config.ts` → `/kontakt` |
| `/personvern/` | **404** | `/personvern` |
| `/vilkar/` | **404** | `/vilkar` |
| `/sikkerhet/` | **404** | `/sikkerhet` |
| `/kom-i-gang/` | 200 | — |

| ID | Sev | Funn |
| --- | --- | --- |
| **G-LEGAL-01** | **P0** | **Personvern/vilkår/sikkerhet 404** på marketing — GDPR/RFP §3 brudd vs published redirects |

---

# SUB G.5 — F-LYV cross-reference + SOC2/DATA_GOV (marketing PII)

## G.5.1 Er noe av de 7 LYVENDE-claims Umbraco-relatert?

| F-LYV | Claim | Umbraco-kobling |
| --- | --- | --- |
| F-LYV-01 | Ingen tilgang via URL alene | **Indirekte** — gjelder `app.*` middleware; marketing er **bevisst public** (annen stack) |
| F-LYV-02 | CI Hardening Høy | **Nei** — GitHub/Azure deploy for Umbraco er **separat** workflow uten `ci:guard` |
| F-LYV-03 | Ingen direkte prod-endringer | **Delvis** — Umbraco deploy Azure OIDC; DB content uten git parity (CMS DB) |
| F-LYV-04 | Pen-test gjennomført | **Nei** |
| F-LYV-05 | Idempotency implementert | **Nei** |
| F-LYV-06 | TypeScript strict | **Nei** |
| F-LYV-07 | Ingen `any` | **Nei** |

**Ingen LYVENDE claim navngir Umbraco eksplisitt.** DD-risiko kommer via **implisitte hel-stack-påstander**:

## G.5.2 Implisitte compliance-claims vs Umbraco (ny vurdering)

| Dokument | Claim | Umbraco prod-motbevis | Klassifisering |
| --- | --- | --- | --- |
| **SoA A.10** | «TLS via **Vercel/Supabase**» | Marketing på **Azure/IIS** — ikke nevnt; **ingen HSTS-header** | **PARTIAL → G-LYV-U01** |
| **COMPLIANCE_OVERVIEW §5.2** | «HTTPS (TLS)» | HTTPS ja, men **svakere header posture** enn app | **PARTIAL** |
| **SOC2 CC6/C1** | Access + confidentiality «Implementert» | Public marketing + **500/404** på kontakt/legal | **PARTIAL** |
| **DATA_GOVERNANCE §2.3** | Confidential: navn, e-post | Kontaktskjemaer på Umbraco samler PII — **ingen policy-seksjon for marketing forms** | **PARTIAL → G-PII-01** |
| **ENTERPRISE_RFP §3** | GDPR + DPA | Personvernside **404** på kanonisk host | **LYVENDE-adjacent → G-LEGAL-01** |
| **F3-04 / G-HDR-01** | (v1) Marketing security headers | **100% bekreftet** på Umbraco | **P1 REELL gap** |

| ID | Sev | Funn |
| --- | --- | --- |
| G-LYV-U01 | P2 | SoA A.10 **scope gap** — Azure marketing utelatt fra TLS-evidence narrative |
| G-PII-01 | P2 | DATA_GOVERNANCE / SOC2 **nevner ikke** marketing form PII path (Umbraco POST vs Next `/api/contact`) |

## G.5.3 F3-04 konklusjon

**F3-04 er Umbraco-siden, ikke Next.** Fase E **E-HDR-01** (app CSP) og **G-HDR-01** (marketing HSTS/CSP) er **komplementære P1** — kjøper som sjekker **kun** `app.lunchportalen.no` misses marketing gap.

---

# SUB G.6 — Skip-auth / public surface (Umbraco)

Marketing har **ikke** Next `X-Lp-Mw-Skip-Auth` — analog modell:

| Surface | Auth-modell | DD-notat |
| --- | --- | --- |
| **Alle marketing pages** | **Public** (ingen member auth) | Forventet |
| **Backoffice** | Umbraco identity cookie | `/umbraco/login` **200** offentlig — auth **etter** login |
| **Form POST** | `_ContactFormBlock` → POST `/kontakt/` | **Ingen C# handler i repo** — sannsynlig Umbraco surface/plugin i DB eller **broken** |
| **Demo booking** | `_DemoBookingBlock` → fetch POST `/kontakt/` + CSRF | Krever fungerende `/kontakt/` — **500** |
| **Kom i gang** | `_KomIGangFormBlock` | **Client-only fake success** — **ingen server submit** |
| **Next `/api/contact`** | Rate limit + lead + SMTP | På **`app.*` domain** — **ikke** wired fra Umbraco forms i repo |

### Prod route matrix (PII-relevant)

| Route | Status | PII? |
| --- | --- | --- |
| `/kontakt/` | **500** | **Ja** — side + skjema utilgjengelig |
| `/demo/` | 200 | Ja — booking block |
| `/kom-i-gang/` | 200 | Ja — **fake submit** |
| `/umbraco/login` | 200 | Credentials target |

| ID | Sev | Funn |
| --- | --- | --- |
| **G-KONTAKT-01** | **P0** | **`/kontakt/` HTTP 500** — primary lead/PII intake broken on marketing host |
| G-FORM-01 | P2 | `_KomIGangFormBlock` viser suksess **uten** network call — misleading CRO |
| G-FORM-02 | P2 | Ingen form controller i git — DD kan ikke verifisere PII handling chain |

---

# Fase G — funn-oppsummering

| ID | Sev | Rolle | Funn |
| --- | --- | --- | --- |
| G-HDR-01 | **P1** | MARKETING | F3-04 confirmed — no HSTS/CSP on lunchportalen.no |
| G-KONTAKT-01 | **P0** | MARKETING | /kontakt/ prod 500 |
| G-LEGAL-01 | **P0** | MARKETING+COMPLIANCE | personvern/vilkar/sikkerhet 404 |
| G-BO-01 | P2 | MARKETING | Standard /umbraco/login on public domain |
| G-BO-02 | P2 | MARKETING+DEVOPS | Azure hostname leak via app proxy cookies |
| G-SEC-01 | P2 | MARKETING | HMAC secret in appsettings.json |
| G-HDR-02 | P2 | MARKETING | Server/X-Powered-By disclosure |
| G-HDR-03 | P2 | MARKETING | Inconsistent X-Frame-Options |
| G-SEO-01 | P2 | MARKETING | www/apex canonical split |
| G-LYV-U01 | P2 | COMPLIANCE | SoA TLS scope omits Azure |
| G-PII-01 | P2 | COMPLIANCE | DATA_GOV silent on marketing forms |
| G-FORM-01 | P2 | MARKETING | Fake kom-i-gang form success |
| G-FORM-02 | P2 | MARKETING | No C# form handler in repo |

---

## Completeness (G.1–G.6)

| Item | Status |
| --- | --- |
| G.1 umbraco17 prod + Umbraco/ dead | **COVERED** |
| G.2 F3-04 header VOC | **COVERED** |
| G.3 backoffice/members/2FA | **COVERED** |
| G.4 SEO + robots/sitemap | **COVERED** |
| G.5 F-LYV × Umbraco + PII policies | **COVERED** |
| G.6 public forms / auth model | **COVERED** |
| G.7 Akutt-actions (anbefalt) | **COVERED** |

---

# SUB G.7 — Akutt-actions (anbefalt prioritert handlingsliste)

**Scope:** Anbefalinger only — **ingen fix i audit-sesjonen.** Eier beslutter timing.

| # | Action | Formål | Hint |
| --- | --- | --- | --- |
| **1** | **Sentry / Application Insights** — når brøt `/kontakt/`? Sample stack? | Root-cause på HTTP 500 | Azure App Service → `lunchportalen-umbraco` logs; korreler med siste deploy (`main_lunchportalen-umbraco.yml` SHA) og Umbraco content publish |
| **2** | **Uptime monitoring** på `lunchportalen.no` (UptimeRobot / Azure Monitor) | P0-ruter oppdages før kunde/DD | Alert på `/`, `/kontakt/`, `/personvern/`, `/vilkar/` — ikke bare app-host |
| **3** | **Umbraco backoffice** — finnes `/personvern`, `/vilkar`, `/sikkerhet` som content nodes? | Avklar 404 vs manglende publish vs feil URL | Hvis document types mangler: minimum **stub pages** (H1 + kontakt + DPA-lenke) under riktig slug; sync med `next.config.ts` redirects |
| **4** | **`web.config` / IIS** — strip `X-Powered-By` (+ vurder HSTS via Azure) | Reduser fingerprinting; delvis header-gap | One-time infra — ikke app-kode; kan kombineres med Azure Front Door response headers |

---

## STOP-PUNKT G

**Fase G COMPLETE** (inkl. eskalering + G.7).

**Severity etter eskalering:** **2 P0** (G-KONTAKT-01, G-LEGAL-01) · **22 P1** kumulativ.

**Neste:** Vent **`GO Fase H`** (Sanity studio) eller **`GO Fase I`** (executive summary v2).

*READ-ONLY — ingen Umbraco/Azure/config endringer i denne sesjonen.*
