import assert from "node:assert/strict";

function shardSlice(rows, shard, shardCount) {
  const n = rows.length;
  const base = Math.floor(n / shardCount);
  const rem = n % shardCount;
  const start = shard * base + Math.min(shard, rem);
  const end = start + base + (shard < rem ? 1 : 0);
  return rows.slice(start, end);
}

const rows = Array.from({ length: 2000 }, (_, i) => ({ index: i }));
const parts = [0, 1, 2, 3].map((s) => shardSlice(rows, s, 4));
assert.equal(parts.reduce((a, p) => a + p.length, 0), 2000);
assert.deepEqual(
  parts.flat().map((r) => r.index),
  rows.map((r) => r.index),
);
for (const p of parts) assert.equal(p.length, 500);
console.log("auth-refresh-shard-slice.test.mjs: PASS");
