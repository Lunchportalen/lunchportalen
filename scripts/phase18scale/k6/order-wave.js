/**
 * PHASE 18SCALE — authenticated order wave (k6).
 * Env: PHASE18_BASE_URL, PHASE18_SESSIONS_FILE (ndjson), PHASE18_SERVICE_DATE, PHASE18_WAVE_DURATION
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend, Counter } from "k6/metrics";

const base = (__ENV.PHASE18_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const serviceDate = __ENV.PHASE18_SERVICE_DATE || "";
const duration = __ENV.PHASE18_WAVE_DURATION || "30m";
const targetOrders = Number(__ENV.PHASE18_ORDER_TARGET || 100000);
const arrivalRate = Number(__ENV.PHASE18_ORDER_ARRIVAL_RATE || Math.ceil(targetOrders / 1800));

const orderOk = new Rate("phase18_order_ok");
const orderLatency = new Trend("phase18_order_latency", true);
const orderDup = new Counter("phase18_order_duplicate");
const orderCap = new Counter("phase18_order_capacity");
const order5xx = new Counter("phase18_order_5xx");

const sessions = new SharedArray("sessions", () => {
  const path = __ENV.PHASE18_SESSIONS_FILE || "docs/rc/phase18scale/evidence/sessions.ndjson";
  const raw = open(path);
  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
});

export const options = {
  scenarios: {
    order_wave: {
      executor: "constant-arrival-rate",
      rate: arrivalRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: Math.min(500, Math.max(50, Math.ceil(arrivalRate / 2))),
      maxVUs: Math.min(2000, Math.max(100, arrivalRate * 3)),
    },
  },
  thresholds: {
    phase18_order_ok: ["rate>0.99"],
    phase18_order_latency: ["p(95)<1500", "p(99)<3000"],
    phase18_order_5xx: ["count<100"],
  },
};

export default function () {
  if (!sessions.length) {
    orderOk.add(false);
    return;
  }
  const s = sessions[(__ITER + __VU) % sessions.length];
  const idem = `p18-ord-${s.user_id}-${serviceDate}-${__ITER}-${__VU}`;
  const res = http.post(
    `${base}/api/orders`,
    JSON.stringify({ date: serviceDate, action: "set", choice_key: "varmmat" }),
    {
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idem,
        "Accept-Language": s.locale || "nb-NO",
      },
      timeout: "30s",
      tags: { route: "orders_set", country: s.country || "NA" },
    },
  );
  orderLatency.add(res.timings.duration);
  const body = (() => {
    try {
      return res.json();
    } catch {
      return {};
    }
  })();
  const intentional =
    body?.code === "CAPACITY_EXCEEDED" ||
    body?.error === "CAPACITY_EXCEEDED" ||
    body?.code === "CUTOFF" ||
    String(body?.error || "").includes("CUTOFF");
  if (res.status >= 500) order5xx.add(1);
  if (intentional) orderCap.add(1);
  const ok = res.status === 200 && body?.ok === true;
  if (ok && body?.data?.idempotent) orderDup.add(1);
  orderOk.add(ok || intentional);
  check(res, { "order finalizable": () => ok || intentional || res.status === 409 });
  sleep(0.01);
}
