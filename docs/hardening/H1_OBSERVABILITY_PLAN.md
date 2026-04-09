# H1 — Observability (plan og status)

**Dato:** 2026-03-28  
**H1-fokus:** Kartlegge **alert readiness** og **sporbarhet** uten å introdusere ny leverandør-stack.

---

## 1. Logging og RID

- API-responser bruker **`jsonOk` / `jsonErr`** med **RID** der `lib/http/respond` brukes.  
- **H1:** Ingen global endring av loggformat; anbefaling uendret fra `OBSERVABILITY_AND_OPERATIONS_PLAN.md` (H0).

---

## 2. Health

- **`/superadmin/system`**, **`/api/health`**, **`/api/system/health`**: Eksisterende flater — **pilot** bør bekrefte at overvåkning peker på minst én HTTP-health som er akseptabel for drift.

---

## 3. Feilede operasjoner (kategorier)

| Kategori | Observabilitet |
|----------|----------------|
| **Social publish** | Responskoder + status i DB; eskalér ved gjentatt `PUBLISH_*`-feil. |
| **SEO/CMS publish** | 5xx på content-API; CMS bruker eksisterende feilpanel der implementert. |
| **ESG build** | RPC/cron-feil i logger; ESG-UI viser «ikke data» ved tomme snapshots. |

---

## 4. Alert readiness (minimum før live)

- [ ] **5xx-rate** terskel på hoveddomene.  
- [ ] **Cron silence** (ingen vellykket kjøring innen forventet vindu) for valgte jobber.  
- [ ] **RID** i support-runbook (kunde oppgir RID ved henvendelse).

---

## 5. H1 endringer

- Ingen ny metrics-pipeline i kode. Dokumentasjonen oppdaterer **forventninger** for pilot.
