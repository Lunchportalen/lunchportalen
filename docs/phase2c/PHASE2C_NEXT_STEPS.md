# Phase 2C — Next steps



## Ferdig (2C1) — Company admin MVP



- Én **AdminNav** med tower-lenker; KPI fra `loadAdminContext` (lokasjoner + ordre + ansatte).

- Avtale: **korrekt** fetch til `GET /api/admin/agreement`; binding/oppsigelse-måneder **leses** når rad finnes.

- Dokumentasjon under `docs/phase2c/COMPANY_ADMIN_*.md`.



## Ferdig (2C2) — Kitchen runtime MVP

- **`/kitchen`:** `KitchenRuntimeClient` — produksjonsliste (`GET /api/kitchen` med korrekt `data`-unwrap) + aggregert rapport (`KitchenView`).
- **`/kitchen/report`:** redirect til `/kitchen?tab=aggregate`.
- Dokumentasjon: `KITCHEN_*_RUNTIME.md` under `docs/phase2c/`.



## Ferdig (2C3) — Driver runtime MVP

- **`/driver`:** `DriverRuntimeClient` → `DriverClient` — filter, mobil progress, CSV-lenke per vindu, `normalizeStopsResponse` i `lib/driver/`.
- **`POST /api/driver/confirm`:** uendret kontrakt; fortsatt ekte «markér levert».
- Dokumentasjon: `DRIVER_*_RUNTIME.md` under `docs/phase2c/`.

## Ferdig (2C4) — Superadmin runtime MVP

- **`/superadmin`:** kontrollsignaler (pending firma/avtaler, ordre i dag/uke) + oppdaterte hurtiglenker; `capabilities` uendret som register.
- **Ingen** nye mutasjoner på forsiden; følsomme flyter forblir på eksisterende sider/API.
- Dokumentasjon: `SUPERADMIN_*_RUNTIME.md` under `docs/phase2c/`.

## Neste (2D og videre — ikke startet her)

- Produkt-/release-plan utenfor 2C0–2C4 scope; **ikke** SEO/social/ESG-runtime i denne leveransen.

- Ved behov: detaljert `capabilities` → prod-klar matrise (ja/nei) som egen øvelse.



## Kritiske gaps (løpende)



- **Automatisk påminnelse:** krever cron + outbound — ikke levert i 2C1.  

- **Faktura-HTML-oversikt:** avhengig av produkt/API — CSV er fasit i 2C1.



---



**Stoppregel etter 2C4:** Ikke starte SEO/social/ESG-runtime eller 2D-arbeid i samme leveranse som superadmin 2C4 — superadmin 2C4 er **ferdig** her.


