/**
 * PHASE 18SCALE — authenticated cancellation wave (k6).
 * 50k unique pre-cutoff cancellations + optional duplicate retries.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend, Counter } from "k6/metrics";

const base = (__ENV.PHASE18_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const serviceDate = __ENV.PHASE18_SERVICE_DATE || "";
const duration = __ENV.PHASE18_WAVE_DURATION || "10m";
const target = Number(__ENV.PHASE18_CANCEL_TARGET || 50000);
const arrivalRate = Number(__ENV.PHASE18_CANCEL_ARRIVAL_RATE || Math.ceil(target / 600));
const duplicateMode = (__ENV.PHASE18_CANCEL_DUPLICATE || "0") === "1";

const cancelOk = new Rate("phase18_cancel_ok");
const cancelLatency = new Trend("phase18_cancel_latency", true);
const cancel5xx = new Counter("phase18_cancel_5xx");
const cancelCutoff = new Counter("phase18_cancel_cutoff_reject");

const sessions = new SharedArray("sessions", () => {
  const path = __ENV.PHASE18_SESSIONS_FILE || "docs/rc/phase18scale/evidence/sessions.ndjson";
  return open(path)
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
});

export const options = {
  scenarios: {
    cancel_wave: {
      executor: "constant-arrival-rate",
      rate: arrivalRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: Math.min(800, Math.max(50, Math.ceil(arrivalRate / 2))),
      maxVUs: Math.min(3000, Math.max(100, arrivalRate * 4)),
    },
  },
  thresholds: {
    phase18_cancel_ok: ["rate>0.99"],
    phase18_cancel_latency: ["p(95)<1000", "p(99)<2500"],
    phase18_cancel_5xx: ["count<50"],
  },
};

export default function () {
  if (!sessions.length) {
    cancelOk.add(false);
    return;
  }
  const s = sessions[(__ITER + __VU) % sessions.length];
  const uniqueKey = `p18-can-${s.user_id}-${serviceDate}`;
  const idem = duplicateMode ? uniqueKey : `${uniqueKey}-${__ITER}`;
  const res = http.post(
    `${base}/api/orders`,
    JSON.stringify({ date: serviceDate, action: "cancel" }),
    {
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idem,
        "Accept-Language": s.locale || "nb-NO",
      },
      timeout: "30s",
      tags: { route: "orders_cancel", country: s.country || "NA", provider: String(s.provider_id || "").slice(0, 8) },
    },
  );
  cancelLatency.add(res.timings.duration);
  const body = (() => {
    try {
      return res.json();
    } catch {
      return {};
    }
  })();
  if (res.status >= 500) cancel5xx.add(1);
  const cutoff =
    body?.code === "CUTOFF" ||
    String(body?.error || "").includes("CUTOFF") ||
    String(body?.message || "").toLowerCase().includes("cutoff");
  if (cutoff) cancelCutoff.add(1);
  const ok = res.status === 200 && body?.ok === true;
  cancelOk.add(ok || (duplicateMode && ok) || cutoff);
  check(res, { "cancel handled": () => ok || cutoff || res.status === 409 });
  sleep(0.005);
}
