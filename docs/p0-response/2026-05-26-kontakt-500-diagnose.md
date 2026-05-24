# P0 — `/kontakt/` HTTP 500 diagnose

**Audit-funn:** G-KONTAKT-01 · DC-060  
**Dato:** 2026-05-26  
**Sesjon:** P0-1 (READ-ONLY — ingen Umbraco-kodeendringer)  
**Host:** `https://www.lunchportalen.no` (Azure App Service `lunchportalen-umbraco`, Umbraco 17.3.4)

---

## 1. Symptom (prod repro)

```http
GET https://www.lunchportalen.no/kontakt/ HTTP/1.1

HTTP/1.1 500 Internal Server Error
Content-Length: 0
Server: Microsoft-IIS/10.0
X-Powered-By: ASP.NET
```

| Probe | Dato (UTC) | Resultat |
| --- | --- | --- |
| `curl -i https://www.lunchportalen.no/kontakt/` | 2026-05-24 | **500**, tom body |
| Re-verify | 2026-05-26 | **500**, tom body (uendret) |

**Sammenligning (samme host):**

| Route | Status | Template-mønster |
| --- | --- | --- |
| `/` | 200 | HomePage |
| `/demo/` | 200 | `BlockListModel` + `blocklist/default.cshtml` |
| `/priser/` | 200 | `BlockListModel` |
| `/om-oss/` | 200 | `BlockListModel` |
| `/kontakt/` | **500** | **`BlockGridModel` + `GetBlockGridHtmlAsync`** ← avviker |
| `/losningen/` | 404 | content/slug (separat P1) |

**Impact:** Primær lead-intake og PII-skjema utilgjengelig. Demo-booking som POST-er til `/kontakt/` er også blokkert (side laster ikke).

---

## 2. Sentry / Application Insights (A.1)

### 2.1 Repo-evidens — observability gap på Umbraco

| Kilde | Sentry | Application Insights | Serilog |
| --- | --- | --- | --- |
| `umbraco17/lunchportalen/appsettings.json` | ✗ | ✗ | ✓ (fil/console only) |
| `umbraco17/lunchportalen/appsettings.Production.json` | ✗ | ✗ | — |
| Custom C# (`Program.cs`) | ✗ | ✗ | standard bootstrap |

**Konklusjon:** Ingen Sentry- eller App-Insights-integrasjon er konfigurert i git for marketing-host. Stack trace for `/kontakt/` 500 finnes **ikke** i dette repo — må hentes manuelt.

### 2.2 Påkrevd manuell sjekk (eier)

Åpne **ett** av disse (avhengig av hva som er aktivert i Azure):

1. **Azure Portal** → App Service `lunchportalen-umbraco` → **Application Insights** → Failures / Exceptions  
   Filter: URL contains `kontakt`, siste 30 dager
2. **Azure Portal** → App Service → **Log stream** / **Diagnose and solve problems** → HTTP 5xx
3. **Sentry** (hvis marketing-prosjekt finnes separat) → Issues → `url:/kontakt`

**Noter i Sesjon 3 hvis funnet:**

| Felt | Verdi (fyll inn) |
| --- | --- |
| Exception type | _TBD — eier_ |
| Message | _TBD — eier_ |
| Top stack frame | _TBD — eier_ |
| Første occurrence | _TBD — eier_ |
| Korrelert deploy/publish | _TBD — eier_ |

### 2.3 Eskalert audit-funn (P1)

**G-OBS-01 (ny):** Umbraco marketing-host mangler sentral exception-telemetri i repo og sannsynligvis i drift. 500 på `/kontakt/` har vært synlig i audit (2026-05-25) uten automatisk alert — bekrefter behov for uptime monitoring (Del B) og App Insights på `lunchportalen-umbraco`.

---

## 3. Kode- og deploy-analyse (A.2)

### 3.1 Hvor ligger Umbraco?

| | |
| --- | --- |
| Repo | Monorepo — `umbraco17/lunchportalen/` |
| Deploy | `.github/workflows/main_lunchportalen-umbraco.yml` → Azure `lunchportalen-umbraco` |
| Custom C# | Kun `Program.cs` (standard Umbraco bootstrap) |
| SurfaceControllers / form handlers | **0** i git |

Marketing er **view-layer + CMS-innhold i Azure SQL** — ingen server-side form-handler i repo.

### 3.2 Kontakt-relaterte filer

| Fil | Rolle |
| --- | --- |
| `Views/contact.cshtml` | Side-template — **bruker BlockGrid** |
| `Views/Partials/_ContactPageHeroBlock.cshtml` | Hero-blokk |
| `Views/Partials/_ContactFormBlock.cshtml` | Skjema (POST `/kontakt/`) |
| `Views/Partials/blocklist/default.cshtml` | BlockList-renderer m/ PascalCase-fallback → `_Contact*Block.cshtml` |
| `Views/Partials/blockgrid/default.cshtml` | BlockGrid-renderer — **ingen `contact*` aliases** |

### 3.3 Git-historikk (contact)

```text
4484a041 restore Umbraco Azure CMS views and assets locally (2026-05-05)
  + umbraco17/lunchportalen/Views/contact.cshtml
  + umbraco17/lunchportalen/wwwroot/css/contact.css
```

Ingen senere commits på `contact*` etter restore. Sannsynlig at feilen har eksistert siden contact-template ble introdusert med feil block-API, eller siden CMS-innhold ble publisert med Block List editor mens view forventer Block Grid.

### 3.4 Kritisk kode-diff (root cause evidence)

**`contact.cshtml` (feiler):**

```csharp
@if (Model?.Value<BlockGridModel>("contentBlocks")?.Any() == true)
{
    @await Html.GetBlockGridHtmlAsync(Model, "contentBlocks")
}
```

**Alle andre block-sider (fungerer), f.eks. `fordelerPage.cshtml`, `komIGangPage.cshtml`, `demoPage.cshtml`:**

```csharp
var blocks = Model.Value<BlockListModel>("contentBlocks");
@await Html.PartialAsync("~/Views/Partials/blocklist/default.cshtml", blocks)
```

**BlockList fallback** (`blocklist/default.cshtml` L47–51) resolver automatisk:

- `contactPageHeroBlock` → `_ContactPageHeroBlock.cshtml`
- `contactFormBlock` → `_ContactFormBlock.cshtml`

**BlockGrid** (`blockgrid/default.cshtml`) har **ingen** grener for contact-blokker — selv med riktig editor-type ville hero/skjema ikke rendres uten template-endring.

---

## 4. Hypoteser (rangert)

| # | Hypotese | Sannsynlighet | Evidens |
| --- | --- | --- | --- |
| **H2** | **BlockGrid vs BlockList mismatch** på `contentBlocks` | **Høyest** | Eneste side som bruker `BlockGridModel`/`GetBlockGridHtmlAsync`; alle søsken-sider bruker `BlockListModel`; contact-partials finnes kun i blocklist-sti |
| H1 | Razor compile-error etter deploy | Lav | Andre views på samme deploy fungerer (200); contact.cshtml er enkel og syntaktisk gyldig |
| H3 | Azure SQL schema / content drift | Medium (sekundær) | Kan ikke verifiseres uten backoffice/DB; ville typisk gi tom side, ikke 500, hvis property mangler |
| H4 | Form POST / anti-forgery | Irrelevant for GET | GET `/kontakt/` returnerer 500 før skjema rendres |
| H5 | SMTP / mail-init | Irrelevant for GET | Ingen mail-kode i view pipeline for GET |

**Sannsynligste root cause (pre-App-Insights):**  
`contact.cshtml` kaller `GetBlockGridHtmlAsync` mot property `contentBlocks` som i CMS er konfigurert som **Block List** (som resten av marketing). Umbraco kaster runtime exception ved deserialisering/rendering → IIS 500, tom body, `MacroErrors: Throw` i appsettings forsterker fail-fast.

---

## 5. Anbefalt fix-vei — Sesjon 3

**Scope:** Minimal template-fix i `umbraco17/lunchportalen/Views/contact.cshtml` — align med `fordelerPage.cshtml` / `komIGangPage.cshtml`.

### 5.1 Steg

1. **Bekreft** exception i App Insights (validerer H2 vs alternativ).
2. **Endre** `contact.cshtml`:
   - Erstatt `BlockGridModel` + `GetBlockGridHtmlAsync` med `BlockListModel` + `blocklist/default.cshtml`.
   - Valgfritt: legg til SEO/meta som `komIGangPage.cshtml` (TEXT ONLY, ikke blocker).
3. **Verifiser i Umbraco backoffice:** Kontakt-node har `contentBlocks` med `contactPageHeroBlock` + `contactFormBlock` publisert.
4. **Deploy:** push til `main` under `umbraco17/lunchportalen/**` → trigger `main_lunchportalen-umbraco.yml`.
5. **Prod curl:** `GET /kontakt/` → **200**, hero + skjema synlig.
6. **Form POST (separat ticket):** `_ContactFormBlock` POST-er til `/kontakt/` uten C# handler i repo — avklar Umbraco Forms / plugin / custom controller etter side rendrer.

### 5.2 Patch-skisse (Sesjon 3 — ikke applyet i P0-1)

```csharp
@{
    Layout = "~/Views/Partials/_Layout.cshtml";
    var blocks = Model.Value<BlockListModel>("contentBlocks");
}

@section Head {
    <link rel="stylesheet" href="/css/contact.css" />
}

@if (blocks != null && blocks.Any())
{
    <div class="lp-contact-page">
        @await Html.PartialAsync("~/Views/Partials/blocklist/default.cshtml", blocks)
    </div>
}
```

### 5.3 Non-regression (Sesjon 3)

- [ ] `/`, `/demo/`, `/priser/`, `/om-oss/` fortsatt 200
- [ ] `/kontakt/` 200 desktop + mobil
- [ ] Ingen horisontal scroll på kontaktside
- [ ] Uptime monitor 2 (kontakt) går grønn
- [ ] Form POST dokumentert (fungerende eller eksplisitt backlog)

---

## 6. Fix-effort estimat

| Scenario | Timer | Forutsetning |
| --- | --- | --- |
| H2 bekreftet, BlockList-fix | **2–4 t** | Backoffice-innhold OK, kun template + deploy |
| Backoffice mangler contact blocks | **4–6 t** | + innholdsoppsett i Umbraco |
| Form POST krever ny handler | **6–8 t** | + SurfaceController / Umbraco Forms / e-post integrasjon |

**Anbefalt Sesjon 3-prioritet:** Template-fix først (lavest risiko, høyest sannsynlighet for å fjerne 500).

---

## 7. Kryssreferanser

- [07-umbraco-marketing.md](../audit/enterprise-v2-2026-05-25/07-umbraco-marketing.md) — G-KONTAKT-01
- [99-executive-summary-v2.md](../audit/enterprise-v2-2026-05-25/99-executive-summary-v2.md) — DC-060
- [2026-05-26-uptime-monitoring-config.md](./2026-05-26-uptime-monitoring-config.md) — Del B

---

## 8. STOP-PUNKT P0-1

Diagnose levert. **Ingen kodeendring** i denne sesjonen.  
Neste: eier bekrefter App Insights stack trace → **GO Sesjon 3** for hotfix.
