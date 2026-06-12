# Stage 4-B — Batch produsent-kjede (2026-05-31)

## FASE A — `delivery_batches` klassifisering: **A (død/legacy)**

| Rute | Metode | Skriver til | Brukt i UI? |
|------|--------|-------------|-------------|
| `app/api/kitchen/batch/start/route.ts` | POST | `kitchen_batch` (view → **`kitchen_batches`**) | **Ja** — `KitchenProductionPanel.markPacked()` |
| `app/api/kitchen/batch/set/route.ts` | POST | `kitchen_batch` **update** | **Ja** — fallback ved `BATCH_EXISTS` |
| `app/api/kitchen/batch/route.ts` | PATCH | **`delivery_batches`** upsert | **Nei** — ingen `fetch()` i `app/` |

Live PACK i produksjon (og uigx):

1. `POST /api/kitchen/batch/start` → `admin.from("kitchen_batch").insert({ status: "PACKED", ... })`
2. Ved konflikt: `POST /api/kitchen/batch/set` → `admin.from("kitchen_batch").update({ status: "PACKED" })` (fra QUEUED)

Sjåfør leser **`kitchen_batches`** (`app/api/driver/stops/route.ts`).

**Anbefaling:** Ingen forward for `delivery_batches`. Valgfri opprydding (utenfor 4-B deploy): pek `PATCH /api/kitchen/batch` til `kitchen_batch` eller deprecate ruten.

## Operativ slot

Baseline/uigx: `orders.slot` CHECK = **`default`** only. Batch `delivery_window` må matche (`default`), ikke `lunch` (med mindre orders også har `lunch`).

## FASE B — Produsent-drevet smoke

- `tests/smoke/kitchen-batch-producer-smoke.test.ts` kaller ekte `batch/start` mot uigx (mocket `osloTodayISODate` → `2026-06-04`).
- `scripts/smoke/kitchen-batch-producer-smoke.mjs` wrapper.
- **Ikke** håndsådd `INSERT INTO kitchen_batches` i Stage 4-B pipeline.

## FASE C — Realistisk fixture

`scripts/smoke/stage4-realistic-fixture-seed.mjs`:

- 3 ansatte (2× Loc A, 1× Loc B)
- 2 lokasjoner
- Slot `default` (prod-sannhet; ikke 2 distinkte order-slots pga. `orders_slot_check`)

Pipeline: `scripts/smoke/stage4b-pipeline.mjs`

## Verifisert på uigx (2026-05-31)

| Steg | 2× deterministisk SHA256 |
|------|--------------------------|
| `kitchen-batch-producer-smoke` | vitest: `kitchen_batches` PACKED via `POST batch/start` |
| `kitchen-feed-smoke` | `ae4793ddf375c9845fafb499e13f83c8a94e21ed2cd108df63d8035d7cea1186` |
| `driver-manifest-smoke` | `2444bcf154f4fa59bb0e42c6c6144e29457e9fbbd446ca74f1cd460d61a6eea8` |

Driver-manifest: 1 stop, 3 ordre, slot `default`, `batchProducer: api/kitchen/batch/start`, `leakOrdersAtOtherLocation: 0`.

Fixture: 3 ansatte @ Loc A, Loc B strukturell (ingen ordre pga. én ACTIVE avtale per firma).

**Ingen prod-skriving. Ingen forward/deploy.**
