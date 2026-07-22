/**
 * Deterministic non-overlapping session shard ranges for Phase 18SCALE.
 * Shard i owns ranks [i * shardSize, (i+1) * shardSize) within the stage target list.
 */
export const DEFAULT_SHARD_COUNT = 10;
export const DEFAULT_SHARD_SIZE = 1000;

export function employeeIndexFromEmail(email) {
  const m = String(email || "").match(/p18scale-emp-(\d+)@/i);
  return m ? Number(m[1]) : null;
}

export function normalizeSessionRow(row) {
  const index =
    row?.index != null && Number.isFinite(Number(row.index))
      ? Number(row.index)
      : employeeIndexFromEmail(row?.email);
  return {
    ...row,
    index,
  };
}

export function shardRange(shardIndex, shardCount, stageTarget) {
  const shard = Number(shardIndex);
  const count = Number(shardCount);
  const target = Number(stageTarget);
  if (!Number.isInteger(shard) || shard < 0 || shard >= count) {
    throw new Error(`PHASE18_INVALID_SHARD_INDEX:${shardIndex}`);
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`PHASE18_INVALID_SHARD_COUNT:${shardCount}`);
  }
  if (!Number.isInteger(target) || target < 1) {
    throw new Error(`PHASE18_INVALID_STAGE_TARGET:${stageTarget}`);
  }
  if (target % count !== 0) {
    throw new Error(`PHASE18_STAGE_TARGET_NOT_DIVISIBLE_BY_SHARDS target=${target} shards=${count}`);
  }
  const shardSize = target / count;
  const start = shard * shardSize;
  const end = start + shardSize;
  return { shard, shardCount: count, shardSize, start, end, target };
}

export function selectStageUniverse(rows, stageTarget) {
  const byIndex = [...rows]
    .map(normalizeSessionRow)
    .filter((r) => r?.user_id && r?.email && r?.company_id && r?.location_id && r.index != null)
    .sort((a, b) => Number(a.index) - Number(b.index) || String(a.email).localeCompare(String(b.email)));
  const seenUsers = new Set();
  const seenEmails = new Set();
  const picked = [];
  for (const r of byIndex) {
    if (seenUsers.has(r.user_id) || seenEmails.has(r.email)) continue;
    seenUsers.add(r.user_id);
    seenEmails.add(r.email);
    picked.push(r);
    if (picked.length >= stageTarget) break;
  }
  return picked;
}

export function sliceShardUniverse(universe, shardIndex, shardCount, stageTarget) {
  const { start, end } = shardRange(shardIndex, shardCount, stageTarget);
  return universe.slice(start, end);
}
