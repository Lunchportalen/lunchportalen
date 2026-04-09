# CMS main base — Neste steg (prioritert, lav risiko først)

**Dato:** 2026-03-29  
**Forutsetning:** Ingen stor redesign uten egen mandate; følg `CMS_CONTROL_PLANE_BUILD_SEQUENCE.md`.

1. ~~**IA:** Superadmin hub-lenker + backoffice **modulstatus**~~ — **delvis gjort i CP1** (strip + control-bro); fortsett med superadmin hub om ønskelig.
2. **Uke/meny:** Produkt/UX-avgjorelse på B1 — enten tydelig **deprecate** redaksjonell weekPlan i UI, eller dokumenter eksplisitt **hvor** den brukes (cron/marketing).
3. **Read-only agreement summary** for superadmin/backoffice — **kun** etter dedikert API-design (ingen content save).
4. **Growth:** Én modul-side per hovedområde (social/SEO/ESG) som peker til **sanntids** status fra runtime.
5. **Worker RED:** Egen changeset — implementer eller **disable** stub-jobber (enterprise-krav).
6. **`sanity:live`:** Kjør ved neste kodeendring som berører Sanity.

**Ikke start:** Parallell v2 CMS, nye ordre-tabeller, middleware-rolle uten sikkerhetsreview.
