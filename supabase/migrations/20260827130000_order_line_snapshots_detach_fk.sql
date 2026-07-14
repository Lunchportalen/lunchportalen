-- PHASE 13 — P0 funnet av 21-lands RC-beviset:
-- ordreendring/kansellering FEILER for billing-klare providere.
--
-- Protected Golden Path Impact: JA (skjema som blokkerte ordre-skrivebanen).
--   - Repro: employee SET på dato med eksisterende ordre → lp_order_set
--     sletter order_items → FK order_line_commercial_snapshots.order_line_id
--     (ON DELETE RESTRICT) → 23503 → hele ordreendringen feiler.
--   - Root cause: snapshotene ble modellert som FK-bundne til levende
--     ordrelinjer, men de ER historisk kommersiell sannhet (append-only).
--     En linje som slettes FØR levering er ikke en kommersiell hendelse.
--   - Fix: FK-en fjernes; order_line_id beholdes som historisk nøkkel.
--     Provisjonsposting er uendret og fortsatt fail-closed: den JOIN-er
--     public.order_items og bruker dermed kun snapshots for LEVENDE linjer.
--     Append-only-triggerne på snapshots beholdes uendret.
--   - Norsk produksjon: opphever samme latente blokkering (billing-klare
--     providere fikk 23503 ved ordreendring etter 20260730).
--   - Regresjon: test:golden-path + RC-flytens SET/UPDATE/CANCEL i 21 land
--     kjørt grønt etter endringen (se Fase 13-manifest).

BEGIN;

ALTER TABLE public.order_line_commercial_snapshots
  DROP CONSTRAINT IF EXISTS order_line_commercial_snapshots_order_line_id_fkey;

COMMENT ON COLUMN public.order_line_commercial_snapshots.order_line_id IS
  'Historical key of the order line the snapshot was captured from. NOT a live FK: snapshots are append-only commercial history and must never block pre-delivery order changes. Commission posting joins live order_items and therefore only ever uses snapshots for surviving lines.';

COMMIT;
