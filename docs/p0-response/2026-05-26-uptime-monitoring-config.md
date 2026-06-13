# P0 — Uptime monitoring config

**Audit-funn:** Ingen ekstern monitor på `lunchportalen.no` (enterprise-v2 §G.6)  
**Dato:** 2026-05-26  
**Sesjon:** P0-1

---

## 1. Leverandørvalg

| | Better Stack (Uptime) | UptimeRobot | Azure Availability Tests |
| --- | --- | --- | --- |
| Gratis tier | 3 monitors, 3-min interval | 50 monitors, 5-min | Inkl. i App Insights (begrenset) |
| Slack + e-post | ✓ | ✓ (begrenset på free) | Action groups |
| Marketing + app i ett dashboard | ✓ | ✓ | Krever Azure-only setup |
| Oppsett-tid | ~15 min | ~10 min | ~30 min + Azure RBAC |

**Valgt anbefaling:** **Better Stack Uptime** (gratis tier dekker nøyaktig 3 prod-monitors med 3-min intervall og incident alerts).

**Begrunnelse:** Raskt oppsett uten Azure-infrastruktur-endring, uavhengig av Umbraco/Vercel, og tydelig incident-historikk for DD. Azure Availability Tests kan legges til senere som supplement på `lunchportalen-umbraco`.

---

## 2. Prod-monitors (3 stk)

| # | Navn | URL | Intervall | Forventet | Merknad |
| --- | --- | --- | --- | --- | --- |
| 1 | LP Marketing — Homepage | `https://www.lunchportalen.no/` | 3 min | **200** | Canonical marketing entry |
| 2 | LP Marketing — Kontakt | `https://www.lunchportalen.no/kontakt/` | 3 min | **200** | **Forventet DOWN (500) til Sesjon 3 fix** — monitor skal alerte nå |
| 3 | LP App — Login | `https://app.lunchportalen.no/login` | 3 min | **200** | Root `/` gir **307** → `lunchportalen.no`; `/login` er stabil 200 health proxy |

### 2.1 Avvik fra opprinnelig spec (app monitor)

Opprinnelig spec: `https://app.lunchportalen.no/` med forventet 200.

**Faktisk prod-atferd (2026-05-26):**

```http
GET https://app.lunchportalen.no/ → 307 Location: https://lunchportalen.no/
GET https://app.lunchportalen.no/login → 200
```

**Anbefaling:** Monitor **`/login`** med «Follow redirects: off», expected status 200. Alternativt: monitor `/` med follow redirects + expected 200 på final URL (mindre presist for app-health).

---

## 3. Per-monitor innstillinger (Better Stack UI)

For hver monitor:

| Setting | Verdi |
| --- | --- |
| Check type | HTTP(S) |
| Method | GET |
| Interval | **3 minutes** |
| Timeout | 30 s |
| Follow redirects | **Off** (marketing); **Off** for `/login` |
| Expected status code | **200** |
| Confirmation (down) | **2 consecutive failures** (~6 min før alert) |
| Recovery | 1 success |
| SSL expiry alert | On (14 dager før) |
| Regions | Default (EU + US hvis tilgjengelig på free) |

---

## 4. Alert-kanaler

| Kanal | Mottaker | Formål |
| --- | --- | --- |
| E-post | `post@lunchportalen.no` (eller dedikert ops-alias) | Primær incident |
| Slack | `#ops` / `#lunchportalen-alerts` (webhook) | Rask eskalering |
| SMS | Av — ikke på free tier | — |

**Better Stack:** Settings → Notifications → Add email + Slack incoming webhook.

---

## 5. Credentials & tilgang

| Asset | Lagring (anbefalt) |
| --- | --- |
| Better Stack login | 1Password vault «Lunchportalen Ops» |
| API token (valgfri) | 1Password — item «Better Stack Uptime API» |
| Slack webhook URL | 1Password — item «LP Alerts Slack Webhook» |

**Ikke commit** tokens eller webhook URLs til git.

---

## 6. Oppsett-prosedyre (eier — ~15 min)

### 6.1 Konto

1. Gå til [betterstack.com/uptime](https://betterstack.com/uptime)
2. Registrer med `post@lunchportalen.no` (eller eksisterende ops-konto)
3. Opprett team «Lunchportalen»

### 6.2 Opprett 3 monitors

UI: **Monitors → Create monitor** — bruk tabellen i §2.

### 6.3 Koble alerts

UI: **Settings → Notifications** — e-post + Slack.

### 6.4 Verifiser alert-kanal (test-incident)

1. **Create monitor** (midlertidig):
   - Name: `TEST — alert pipeline`
   - URL: `https://www.lunchportalen.no/personvern/` (prod **404** per audit)
   - Interval: 3 min
   - Expected: 200
   - Down after: 2 failures
2. Vent **~6–9 min** — bekreft e-post/Slack mottatt
3. **Slett** test-monitor
4. Bekreft **3 prod-monitors** fra §2 er **Active**

### 6.5 Forventet tilstand etter oppsett (2026-05-26)

| Monitor | Status | OK? |
| --- | --- | --- |
| Homepage | UP (200) | ✓ |
| Kontakt | **DOWN (500)** | ✓ — korrekt inntil Sesjon 3; bekrefter at alerting virker |
| App Login | UP (200) | ✓ |

---

## 7. Verifikasjonsstatus (P0-1 sesjon)

| Steg | Status | Notat |
| --- | --- | --- |
| Leverandør valgt + dokumentert | ✅ | Denne filen |
| 3 monitors opprettet i Better Stack | ⏳ **Eier** | Krever Better Stack-konto — ikke automatisert fra repo |
| Test-incident (404 URL) + alert mottatt | ⏳ **Eier** | Prosedyre §6.4 |
| Test-monitor slettet | ⏳ **Eier** | — |
| 3 prod-monitors aktive | ⏳ **Eier** | — |
| Dashboard screenshot | ⏳ **Eier** | Legg ved: `docs/p0-response/assets/betterstack-dashboard-2026-05-26.png` |

**Agent stop-punkt:** Uten Better Stack credentials kan monitor-provisjonering ikke fullføres autonomt. Runbook over er klar for eier (~15 min).

---

## 8. API-alternativ (valgfri automatisering)

Better Stack Uptime API (krever token fra dashboard):

```bash
# Eksempel — ikke kjør uten token i 1Password
curl -X POST "https://uptime.betterstack.com/api/v2/monitors" \
  -H "Authorization: Bearer $BETTERSTACK_UPTIME_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.lunchportalen.no/",
    "monitor_type": "status",
    "check_frequency": 180,
    "request_timeout": 30,
    "confirmation_period": 360,
    "recovery_period": 180,
    "expected_status_codes": [200]
  }'
```

Gjenta for `/kontakt/` og `app.lunchportalen.no/login`.

---

## 9. Fremtidige monitors (backlog, ikke P0-1)

Audit anbefaler også (når legal stubs er live):

- `https://www.lunchportalen.no/personvern/`
- `https://www.lunchportalen.no/vilkar/`

Free tier har **3 monitors** — bytt inn eller oppgrader tier når legal P0 (G-LEGAL-01) er løst.

---

## 10. Kryssreferanser

- [2026-05-26-kontakt-500-diagnose.md](./2026-05-26-kontakt-500-diagnose.md)
- [07-umbraco-marketing.md](../audit/enterprise-v2-2026-05-25/07-umbraco-marketing.md) §G.6
