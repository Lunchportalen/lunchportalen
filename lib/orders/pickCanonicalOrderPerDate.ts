/**
 * Deterministic read-side collapse when multiple `orders` rows exist for the same
 * (user, date, slot) — e.g. cancel then re-order inserts a new ACTIVE row alongside CANCELLED.
 *
 * Precedence: ACTIVE > newest updated_at > CANCELLED/other.
 */
export type CanonicalOrderRowLike = {
  status?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
  date?: unknown;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function statusRank(status: unknown): number {
  const s = safeStr(status).toUpperCase();
  if (s === "ACTIVE") return 2;
  if (s === "CANCELLED" || s === "CANCELED") return 1;
  return 0;
}

function timeMs(v: unknown): number {
  if (v == null || safeStr(v) === "") return 0;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** True when `candidate` should replace `incumbent` as the canonical row for a date. */
export function shouldPreferCanonicalOrderRow(
  candidate: CanonicalOrderRowLike,
  incumbent: CanonicalOrderRowLike,
): boolean {
  const cRank = statusRank(candidate.status);
  const iRank = statusRank(incumbent.status);
  if (cRank !== iRank) return cRank > iRank;

  const cUpd = timeMs(candidate.updated_at);
  const iUpd = timeMs(incumbent.updated_at);
  if (cUpd !== iUpd) return cUpd > iUpd;

  const cCre = timeMs(candidate.created_at);
  const iCre = timeMs(incumbent.created_at);
  return cCre > iCre;
}

/** Fold rows into one canonical row per ISO date key. */
export function foldOrdersByDate<TRow extends CanonicalOrderRowLike>(
  rows: readonly TRow[],
  dateKey: (row: TRow) => string | null,
): Map<string, TRow> {
  const map = new Map<string, TRow>();
  for (const row of rows) {
    const d = dateKey(row);
    if (!d) continue;
    const prev = map.get(d);
    if (!prev || shouldPreferCanonicalOrderRow(row, prev)) {
      map.set(d, row);
    }
  }
  return map;
}
