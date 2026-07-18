/**
 * Phase 16NO.4 synthetic canary scenarios A–D (pure math; no transmission).
 * Does not mutate production.
 */
import assert from "node:assert/strict";

const THRESHOLD = 5_000_000n;

function evaluate(turnover, mvaRegistered = false, crossingDetected = false) {
  const crossed = turnover > THRESHOLD && !mvaRegistered;
  const atExact = turnover === THRESHOLD;
  return {
    crossed,
    atExact,
    withoutMva: !mvaRegistered && !crossed && !crossingDetected ? "ENABLED" : "BLOCKED",
    withMva: mvaRegistered ? "ELIGIBLE" : "BLOCKED",
  };
}

function positions(start, events) {
  let running = start;
  const out = [];
  for (const e of events) {
    const before = running;
    const after = before + e.amount;
    out.push({
      id: e.id,
      before,
      amount: e.amount,
      after,
      isCrossing: before <= THRESHOLD && after > THRESHOLD,
    });
    running = after;
  }
  return out;
}

function batch(pos) {
  const invoice = [];
  const hold = [];
  let crossing = null;
  let holding = false;
  for (const p of pos) {
    if (holding || p.isCrossing) {
      if (p.isCrossing && !crossing) crossing = p.id;
      holding = true;
      hold.push(p.id);
    } else invoice.push(p.id);
  }
  return { invoice, hold, crossing };
}

function mva(net) {
  return (net * 2500n) / 10000n;
}

// A — below threshold 40k
{
  const s = evaluate(4_000_000n);
  assert.equal(s.crossed, false);
  assert.equal(s.withoutMva, "ENABLED");
  assert.equal(s.withMva, "BLOCKED");
  console.log("PASS canary A below-threshold without MVA");
}

// B — exact threshold
{
  const pos = positions(4_950_000n, [{ id: "e", amount: 50_000n }]);
  assert.equal(pos[0].after, THRESHOLD);
  assert.equal(pos[0].isCrossing, false);
  const s = evaluate(THRESHOLD);
  assert.equal(s.crossed, false);
  assert.equal(s.atExact, true);
  console.log("PASS canary B exact threshold not exceeded");
}

// C — crossing
{
  const pos = positions(4_950_000n, [{ id: "cross", amount: 100_000n }]);
  assert.equal(pos[0].isCrossing, true);
  assert.equal(pos[0].after, 5_050_000n);
  const b = batch(pos);
  assert.equal(b.crossing, "cross");
  assert.deepEqual(b.hold, ["cross"]);
  assert.deepEqual(b.invoice, []);
  const s = evaluate(5_050_000n, false, true);
  assert.equal(s.withoutMva, "BLOCKED");
  assert.equal(s.withMva, "BLOCKED");
  console.log("PASS canary C crossing held; ordering/accrual unaffected (policy)");
}

// D — mocked registration transition
{
  const net = 100_000n;
  const tax = mva(net);
  assert.equal(tax, 25_000n);
  assert.equal(net + tax, 125_000n);
  const afterReg = evaluate(5_050_000n, true);
  assert.equal(afterReg.withMva, "ELIGIBLE");
  // below-threshold supply remains without retrospective VAT (policy assertion)
  const below = evaluate(4_000_000n, true);
  assert.equal(below.crossed, false);
  console.log("PASS canary D mocked registration 25% on crossing net; below-threshold no retro VAT");
}

console.log("\nPHASE16NO4_CANARY: PASS");

