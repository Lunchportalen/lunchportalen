#!/usr/bin/env node
/**
 * Preload active same-day orders via authenticated HTTP (canonical path).
 * Uses sessions.ndjson; bounded concurrency; checkpoint progress file.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { loadPhase18Env } from "./load-env.mjs";
import { loginCookieJar } from "./lib/http-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const SESSIONS = path.join(OUT, "sessions.ndjson");
const CHECKPOINT = path.join(OUT, "preload-orders.checkpoint.json");

async function placeOrder(base, cookie, date, idem) {
  const res = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idem,
    },
    body: JSON.stringify({ date, action: "set", choice_key: "varmmat" }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.status === 200 && json?.ok === true, json };
}

async function main() {
  loadPhase18Env();
  const base = process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000";
  if (/app\.lunchportalen\.no/i.test(base)) throw new Error("PRODUCTION_APP_URL_FORBIDDEN");
  const target = Number(process.env.PHASE18_ORDER_PRELOAD_TARGET || 100000);
  const concurrency = Number(process.env.PHASE18_ORDER_PRELOAD_CONCURRENCY || 20);
  const serviceDate = process.env.PHASE18_SERVICE_DATE;
  if (!serviceDate) throw new Error("PHASE18_SERVICE_DATE required");
  if (!fs.existsSync(SESSIONS)) throw new Error("sessions.ndjson missing — run issue-auth-sessions");

  const sessions = [];
  const rl = readline.createInterface({ input: fs.createReadStream(SESSIONS), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) sessions.push(JSON.parse(line));
  }
  if (!sessions.length) throw new Error("no sessions");

  let startAt = 0;
  if (fs.existsSync(CHECKPOINT)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
    startAt = Number(cp.completed || 0);
  }

  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
  const cookieByEmail = new Map();
  async function cookieFor(s) {
    if (cookieByEmail.has(s.email)) return cookieByEmail.get(s.email);
    const jar = await loginCookieJar(base, s.email, password);
    cookieByEmail.set(s.email, jar.cookie);
    return jar.cookie;
  }

  let ok = startAt;
  let fail = 0;
  let i = startAt;
  async function worker() {
    while (i < target) {
      const idx = i;
      i += 1;
      const s = sessions[idx % sessions.length];
      const idem = `p18-preload-${s.user_id}-${serviceDate}-${idx}`;
      try {
        const cookie = await cookieFor(s);
        const res = await placeOrder(base, cookie, serviceDate, idem);
        if (res.ok) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
      if ((ok + fail) % 500 === 0) {
        fs.writeFileSync(CHECKPOINT, JSON.stringify({ completed: ok + fail, ok, fail }, null, 2));
        console.log(JSON.stringify({ ok, fail, target }));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const report = {
    phase: "18SCALE",
    LOCAL_ACTIVE_ORDERS_ATTEMPTED: target,
    LOCAL_ACTIVE_ORDERS_OK: ok,
    fail,
    service_date: serviceDate,
    path: "authenticated_http",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "preload-active-orders.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (ok < target * 0.99) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
