/**
 * Markedisolasjon uten å anta DB-migrering:
 * - `market_id` på rad hvis kolonnen finnes (fremtid)
 * - `meta.market_id` / `meta.market` i jsonb
 * - Eksisterende rader uten markering tilskrives **no** (én sannhet for dagens RC).
 */

function readMeta(row: Record<string, unknown>): Record<string, unknown> {
  const m = row.meta;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

export function rowBelongsToMarket(row: Record<string, unknown>, marketId: string): boolean {
  const m = marketId.trim().toLowerCase();
  if (!m) return false;

  const direct = row.market_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct.trim().toLowerCase() === m;
  }

  const meta = readMeta(row);
  const mid = meta.market_id ?? meta.market;
  if (typeof mid === "string" && mid.length > 0) {
    return mid.trim().toLowerCase() === m;
  }

  return m === "no";
}

export function filterPipelineRowsForMarket(
  rows: Record<string, unknown>[],
  marketId: string,
): Record<string, unknown>[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((r) => rowBelongsToMarket(r, marketId));
}
