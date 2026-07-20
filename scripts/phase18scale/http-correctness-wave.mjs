#!/usr/bin/env node
/**
 * Local HTTP cancel+set correctness wave (cookie sessions).
 * Captures error code samples; uses bounded concurrency + request timeouts.
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

loadPhase18Env();
const base = (process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const password =
  process.env.PHASE18_SYNTH_PASSWORD ||
  `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
const date = process.env.PHASE18_SERVICE_DATE || "2026-07-20";
const target = Number(process.env.PHASE18_HTTP_WAVE || 10000);
const concurrency = Number(process.env.PHASE18_HTTP_CONCURRENCY || 8);
const timeoutMs = Number(process.env.PHASE18_HTTP_TIMEOUT_MS || 20000);
const outName = process.env.PHASE18_HTTP_WAVE_OUT || "http-wave-10k.json";
const progressPath =
  process.env.PHASE18_PROGRESS_PATH ||
  path.join(OUT, `${path.parse(outName).name}.progress.ndjson`);

const sessions = [];
const rl = readline.createInterface({
  input: fs.createReadStream(path.join(OUT, "sessions.ndjson")),
  crlfDelay: Infinity,
});
for await (const line of rl) {
  if (line.trim()) sessions.push(JSON.parse(line));
}
if (!sessions.length) throw new Error("no sessions");

const cookieBy = new Map();
const failCodes = {};

async function cookie(s, force = false) {
  if (!force && cookieBy.has(s.email)) return cookieBy.get(s.email);
  const jar = await loginCookieJar(base, s.email, password);
  cookieBy.set(s.email, jar.cookie);
  return jar.cookie;
}

async function postOrder(c, body, idem) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: {
        Cookie: c,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idem,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json, ok: res.status === 200 && json?.ok === true };
  } finally {
    clearTimeout(t);
  }
}

function noteFail(prefix, res) {
  const code = res?.json?.code || res?.json?.error || `HTTP_${res?.status || "ERR"}`;
  const key = `${prefix}:${code}`;
  failCodes[key] = (failCodes[key] || 0) + 1;
}

let i = 0;
let setOk = 0;
let setFail = 0;
let cancelOk = 0;
let cancelFail = 0;

async function worker() {
  while (true) {
    const idx = i;
    i += 1;
    if (idx >= target) return;
    const s = sessions[idx % sessions.length];
    try {
      let c = await cookie(s);
      let cancel = await postOrder(c, { date, action: "cancel" }, `p18-10k-c-${idx}`);
      if (!cancel.ok && (cancel.status === 401 || cancel.status === 403)) {
        c = await cookie(s, true);
        cancel = await postOrder(c, { date, action: "cancel" }, `p18-10k-c-retry-${idx}`);
      }
      if (cancel.ok) cancelOk += 1;
      else {
        cancelFail += 1;
        noteFail("cancel", cancel);
      }

      let set = await postOrder(c, { date, action: "set", choice_key: "varmmat" }, `p18-10k-s-${idx}`);
      if (!set.ok && (set.status === 401 || set.status === 403)) {
        c = await cookie(s, true);
        set = await postOrder(c, { date, action: "set", choice_key: "varmmat" }, `p18-10k-s-retry-${idx}`);
      }
      if (set.ok) setOk += 1;
      else {
        setFail += 1;
        noteFail("set", set);
      }
    } catch (e) {
      setFail += 1;
      cancelFail += 1;
      const key = `exception:${e?.name || "Error"}`;
      failCodes[key] = (failCodes[key] || 0) + 1;
    }
    const done = setOk + setFail;
    if (done > 0 && done % 50 === 0) {
      const snap = {
        done,
        setOk,
        setFail,
        cancelOk,
        cancelFail,
        target,
        failCodes,
        stamped_at: new Date().toISOString(),
      };
      try {
        fs.appendFileSync(progressPath, `${JSON.stringify(snap)}\n`);
      } catch {
        /* best-effort */
      }
      if (done % 500 === 0) console.log(JSON.stringify(snap));
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const report = {
  phase: "18SCALE",
  target,
  concurrency,
  timeoutMs,
  SET_OK: setOk,
  SET_FAIL: setFail,
  CANCEL_OK: cancelOk,
  CANCEL_FAIL: cancelFail,
  failCodes,
  stamped_at: new Date().toISOString(),
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, outName), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(setFail === 0 && cancelFail === 0 ? 0 : 2);
