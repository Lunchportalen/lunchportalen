# ESG — source of truth (Phase 2D3)

**Status:** Runtime MVP — CMS/backoffice-flate leser **eksisterende** tabeller og API-er. Ingen ny operativ sannhet.

---

## 1. Kanonisk datamodell

| Lag | Tabell / artefakt | Innhold | Oppdateres av |
|-----|-------------------|---------|----------------|
| **Snapshot (rapportering)** | `esg_monthly_snapshots`, `esg_yearly_snapshots` | Ordrer, avbestilling i tide, svinn, kostnader, stabilitet (`stability_score`), CO₂e m.m. | Cron/RPC (`esg_build_daily`, `esg_build_monthly`, `esg_build_yearly`, låseruter) |
| **Rullering (aggregat)** | `esg_monthly` | `delivered_count`, `cancelled_count`, `delivery_rate`, `waste_estimate_kg`, `co2_estimate_kg` | `api/cron/esg/generate` m.fl. |
| **Legacy / historisk** | `esg_monthly` (eldre migrasjoner) | Kan ha overlapp i navn med nyere skjema — **les** via samme kolonner som dagens API | Se migrasjoner |

**Canonical read-path for CMS 2D3:** `fetchCompanyEsgSnapshotSummary` (`lib/esg/fetchCompanyEsgSnapshotSummary.ts`) → `esg_monthly_snapshots` + `esg_yearly_snapshots` (siste 12 måneder + inneværende år, Oslo-måned).

---

## 2. API-spor (aktive)

| Rute | Rolle | Data |
|------|-------|------|
| `GET /api/admin/esg/summary` | `company_admin` + company scope | Samme snapshot-spørring som over |
| `GET /api/superadmin/esg/summary?company_id=` | `superadmin` | Idem |
| `GET /api/backoffice/esg/summary?company_id=` | `superadmin` (backoffice layout) | Idem — **canonical for CMS-shell** |
| `GET /api/superadmin/esg/latest-monthly` | `superadmin` | `esg_monthly` + firmanavn |
| `GET /api/backoffice/esg/latest-monthly` | `superadmin` | Idem |

**Cron / RPC (ikke endret i 2D3):**  
`app/api/cron/esg/daily`, `monthly`, `yearly`, `lock/monthly`, `lock/yearly`, `generate`.

**Øvrige superadmin ESG-ruter (uendret):** PDF, eksport JSON/CSV, benchmark — se `app/api/superadmin/esg/*`.

---

## 3. Delte biblioteker (2D3)

- `lib/esg/osloMonth.ts` — `isoMonthStartOslo`, `addMonthsIso` (konsistent måned for spørringer).
- `lib/esg/fetchCompanyEsgSnapshotSummary.ts` — én implementasjon brukt av admin, superadmin og backoffice summary.
- `lib/esg/latestMonthlyRollupList.ts` — én implementasjon for `latest-monthly` (superadmin + backoffice).

---

## 4. Legacy vs aktivt

| Spor | Status |
|------|--------|
| `esg_*_snapshots` via summary-API | **Aktiv** — kilde for tall i CMS og admin |
| `esg_monthly` rulleringsliste | **Aktiv** — firmavelger / oversikt; merket som estimat i UI der relevant |
| Superadmin `/superadmin/esg/*` sider | **Aktiv** — dypere rapporter; lenket fra CMS |
| Nye tabeller eller parallell ESG-motor | **Ikke** introdusert i 2D3 |

---

## 5. Lesing / oppdatering

- **Lesing:** GET-ruter over + server-komponenter som kaller disse.
- **Oppdatering av snapshots:** kun eksisterende cron/RPC — **ikke** fra CMS 2D3.
