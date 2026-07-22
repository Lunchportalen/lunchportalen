import assert from "node:assert/strict";
import {
  DEFAULT_SHARD_COUNT,
  employeeIndexFromEmail,
  shardRange,
  selectStageUniverse,
  sliceShardUniverse,
} from "./session-shards.mjs";

assert.equal(employeeIndexFromEmail("p18scale-emp-42@load.lunchportalen.test"), 42);
assert.equal(employeeIndexFromEmail("nope"), null);

const r0 = shardRange(0, 10, 10000);
assert.deepEqual(r0, { shard: 0, shardCount: 10, shardSize: 1000, start: 0, end: 1000, target: 10000 });
const r9 = shardRange(9, 10, 10000);
assert.deepEqual(r9, { shard: 9, shardCount: 10, shardSize: 1000, start: 9000, end: 10000, target: 10000 });

const rows = Array.from({ length: 12000 }, (_, i) => ({
  user_id: `u${i}`,
  email: `p18scale-emp-${String(i).padStart(5, "0")}@load.lunchportalen.test`,
  company_id: `c${i % 10}`,
  location_id: `l${i % 10}`,
  index: i,
}));
const universe = selectStageUniverse(rows, 10000);
assert.equal(universe.length, 10000);

const seen = new Set();
for (let shard = 0; shard < DEFAULT_SHARD_COUNT; shard += 1) {
  const slice = sliceShardUniverse(universe, shard, 10, 10000);
  assert.equal(slice.length, 1000);
  for (const row of slice) {
    assert.equal(seen.has(row.user_id), false);
    seen.add(row.user_id);
  }
}
assert.equal(seen.size, 10000);

console.log(JSON.stringify({ session_shards_tests: "PASS" }));
