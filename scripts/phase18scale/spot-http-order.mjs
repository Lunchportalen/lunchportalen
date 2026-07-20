#!/usr/bin/env node
/** One authenticated cancel + set against local Next. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { loadPhase18Env } from "./load-env.mjs";
import { loginCookieJar } from "./lib/http-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
loadPhase18Env();
const base = (process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const password =
  process.env.PHASE18_SYNTH_PASSWORD ||
  `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
const date = process.env.PHASE18_SERVICE_DATE || "2026-07-20";

const sessions = [];
const rl = readline.createInterface({
  input: fs.createReadStream(path.join(OUT, "sessions.ndjson")),
  crlfDelay: Infinity,
});
for await (const line of rl) {
  if (line.trim()) sessions.push(JSON.parse(line));
}
const s = sessions[0];
if (!s) throw new Error("no sessions");

const jar = await loginCookieJar(base, s.email, password);
async function post(body, idem) {
  const res = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: {
      Cookie: jar.cookie,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idem,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.status === 200 && json?.ok === true, json };
}

const cancel = await post({ date, action: "cancel" }, `p18-spot-c-${Date.now()}`);
const set = await post({ date, action: "set", choice_key: "varmmat" }, `p18-spot-s-${Date.now()}`);
const report = { email: s.email, date, cancel, set, pass: cancel.ok && set.ok };
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, "spot-http-order.json"), JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 2);
