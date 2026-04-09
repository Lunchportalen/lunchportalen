# Performance & scale plan — ærlig vurdering

**Disclaimer:** Baseline og denne revisjonen **beviser ikke** 50k selskaper × 200 ansatte. Alt under er **hypoteser** til måling.

---

## 1. Hva som er «bevist» i repo (statisk)

- **Enterprise build** kjører `next build` med økt minne og SEO-skript — **bygg** er testet i CI/ lokalt, ikke produksjonslast.
- **Paginering** finnes på utvalgte lister (cron, superadmin) — **delvis** mønster for store datasett.
- **Redis / kø** finnes (`lib/infra/redis`, worker) — **valgfri** i mange miljøer; worker har **stub**-jobber.

---

## 2. DB-hotspots (typiske — NEEDS RE-VERIFICATION)

| Område | Hypotese | Neste steg |
|--------|----------|------------|
| `orders` / dato + `company_id` | Høy lesing på kjernedager | EXPLAIN på representative spørringer i staging |
| `profiles` + session | Per request i auth | Indekser + cache (`authCache`) — verifiser treffrate |
| CMS `content_pages` / varianter | Store JSON-kropper | Unngå full table scan; bruk id + indeks |
| ESG snapshots | Månedlig aggregering | Allerede batch/cron — watch varighet i prod |

---

## 3. Cron / jobs

- Mange **cron**-ruter under `app/api/cron/*` — risiko for **overlap** hvis scheduler feilkonfigureres.  
- **Mitigasjon:** idempotente RPC der mulig; logging med **RID**; alerting ved 5xx.

---

## 4. Dyrt API (kandidater)

- AI-endepunkter (`/api/backoffice/ai/*`, `/api/ai/*`) — **CPU/tokens**; rate limits er delvis på plass.  
- **Control tower** / signals — kan timeoute; eksisterende timeout-mønster i noen ruter.  
- **PDF-eksport** (ESG, rapporter) — minne/CPU; bør testes med representative datasett.

---

## 5. Cache-strategi

- **Public CMS / header:** eksisterende mønstre — **ikke** dokumentert global CDN-cache her.  
- **Anbefaling før pilot:** definer **TTL** og **invalidation** for offentlig forside minst.

---

## 6. Pilot-kapasitet vs langsiktig mål

| Nivå | Realistisk uten lasttest | Anbefaling |
|------|--------------------------|------------|
| **Pilot** | Lav hundretalls samtidige brukere, begrenset antall firma | Akseptabelt hvis DB og Vercel-tier er «standard enterprise» |
| **Langsiktig 50k×200** | **Ikke** validert | Krever dedikert lasttest, DB-skalering, eventuelt lesereplika og kø for tunge jobber |

---

## 7. Leveranser som ikke er features men må til

- **K6/k6 eller Lighthouse CI** på kritiske sider (uke, login) — minst én kjøring lagret som rapport.  
- **Database** `VACUUM`/stats og indeksreview etter første uke med pilotdata.
