#!/usr/bin/env node
// Hard guard: every app/api/.../route.ts must satisfy enterprise JSON contract.
import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const ROOT = process.cwd();
const files = globSync("app/api/**/route.ts", { cwd: ROOT, posix: true }).map((f) => path.join(ROOT, f));

function read(p) {
  return fs.readFileSync(p, "utf8");
}

/** Rid + jsonOk emitted inside lib/http/superadminControlTowerGet.ts */
function passesSuperadminControlTowerPath(text) {
  return (
    /\bsuperadminControlTowerJsonGet\b/.test(text) &&
    /@\/lib\/http\/superadminControlTowerGet/.test(text)
  );
}

function hasRidSource(text) {
  if (passesSuperadminControlTowerPath(text)) return true;
  return (
    /\brid\s*\(/.test(text) ||
    /\bmakeRid\s*\(/.test(text) ||
    /\bpickRid\b/.test(text) ||
    /\brequestId\b/.test(text) ||
    /\bnewRid\s*\(/.test(text) ||
    /\bctx\.rid\b/.test(text) ||
    /\bctx\?\.rid\b/.test(text) ||
    /\bconst\s+rid\s*=/.test(text) ||
    /\blet\s+rid\s*=/.test(text) ||
    /\blet\s+rid\s*:/.test(text) ||
    /\{\s*rid\s*\}\s*=\s*[\w.]+\.ctx/.test(text) ||
    /\{\s*rid\s*[},]/.test(text) ||
    /\.ctx\.rid\b/.test(text) ||
    /\b[a-zA-Z_][\w]*\.rid\b/.test(text)
  );
}

function hasBinarySuccess(text) {
  const ctor = /new\s+Response\s*\(/.test(text) || /new\s+NextResponse\s*\(/.test(text);
  if (!ctor) return false;
  return (
    /text\/csv/i.test(text) ||
    /application\/pdf/i.test(text) ||
    /application\/octet-stream/i.test(text)
  );
}

function errorShapePresent(text) {
  return (
    /ok\s*:\s*false/.test(text) &&
    /\brid\b/.test(text) &&
    /\berror\s*:/.test(text) &&
    (/\bmessage\s*:/.test(text) || /\bmessage\s*,/.test(text)) &&
    (/\bstatus\s*:/.test(text) || /\bstatus\s*,/.test(text))
  );
}

/** Edge runtime — jsonOk/jsonErr fra edgeContract (ingen server-only). */
function passesEdgeContractPath(text) {
  if (!/from\s+["']@\/lib\/http\/edgeContract["']/.test(text)) return false;
  const hasJsonOk = /\bjsonOk\s*\(/.test(text);
  const hasJsonErr = /\bjsonErr\s*\(/.test(text);
  return hasJsonOk && hasJsonErr;
}

function passesRespondPath(text) {
  if (!/from\s+["']@\/lib\/http\/respond["']/.test(text)) return false;
  const hasJsonOk = /\bjsonOk\s*\(/.test(text);
  const hasJsonErr = /\bjsonErr\s*\(/.test(text);
  const binaryOk = hasBinarySuccess(text);
  const authGate = /\bscopeOr401\s*\(/.test(text);
  const internalProxy =
    authGate && /\bfetch\s*\(/.test(text) && /new Response\s*\(/.test(text) && hasJsonErr;

  if (hasJsonErr && (hasJsonOk || binaryOk || internalProxy)) return true;
  if (authGate && hasJsonOk && !hasJsonErr) return true;
  if (authGate && hasJsonErr && !hasJsonOk && !binaryOk && !internalProxy) return true;
  return false;
}

/** Order create/cancel: flat receipt helpers in lib/http/respond (rid + ok + machine fields). */
function passesOrderWriteRespondPath(text) {
  if (!/from\s+["']@\/lib\/http\/respond["']/.test(text)) return false;
  return /\bjsonOrderWriteOk\s*\(/.test(text) && /\bjsonOrderWriteErr\s*\(/.test(text);
}

function passesNextResponseManual(text) {
  if (!/NextResponse\.json/.test(text)) return false;
  const okTrue = /ok\s*:\s*true/.test(text) && /\brid\b/.test(text);
  return okTrue && errorShapePresent(text);
}

function passesContactStyleHelpers(text) {
  if (!/function\s+jsonOk\b/.test(text)) return false;
  if (!/function\s+jsonErr\b/.test(text)) return false;
  if (!/NextResponse\.json/.test(text)) return false;
  return errorShapePresent(text) && /ok\s*:\s*true/.test(text);
}

function passesAiLocalHelpers(text) {
  if (!/\bokJson\s*\(/.test(text) || !/\berrJson\s*\(/.test(text)) return false;
  if (!/ok\s*:\s*true/.test(text) || !/ok\s*:\s*false/.test(text)) return false;
  if (!/\brid\b/.test(text)) return false;
  return /\berror\s*:/.test(text) && /\bmessage\s*:/.test(text) && /\bstatus\b/.test(text);
}

function passesJsonExact(text) {
  return /\bjsonExactOk\s*\(/.test(text) && /\bjsonExactErr\s*\(/.test(text);
}

/** e.g. orders/route, public/register-company — Response(JSON.stringify({ ...payload, rid })) */
function passesJsonPlusErrHelpers(text) {
  if (!/\bfunction\s+json\s*\(\s*rid\s*:\s*string/.test(text)) return false;
  if (!/\bfunction\s+err\s*\(\s*rid\s*:\s*string/.test(text)) return false;
  return (
    /new Response\s*\(\s*JSON\.stringify/.test(text) &&
    /ok\s*:\s*false/.test(text) &&
    /ok\s*:\s*true/.test(text)
  );
}

/** e.g. something/route — local ok(rid)/err(rid) + NextResponse.json */
function passesLocalNextOkErr(text) {
  if (!/\bfunction\s+ok\s*\(/.test(text) || !/\bfunction\s+err\s*\(/.test(text)) return false;
  if (!/NextResponse\.json/.test(text)) return false;
  return /ok\s*:\s*true/.test(text) && /ok\s*:\s*false/.test(text) && /\brid\b/.test(text);
}

function passesApiContract(text) {
  if (passesSuperadminControlTowerPath(text)) return true;
  if (passesEdgeContractPath(text)) return true;
  if (passesOrderWriteRespondPath(text)) return true;
  if (passesRespondPath(text)) return true;
  if (passesNextResponseManual(text)) return true;
  if (passesContactStyleHelpers(text)) return true;
  if (passesAiLocalHelpers(text)) return true;
  if (passesJsonExact(text)) return true;
  if (passesJsonPlusErrHelpers(text)) return true;
  if (passesLocalNextOkErr(text)) return true;
  return false;
}

let failed = false;
for (const file of files) {
  const text = read(file);
  if (!hasRidSource(text)) {
    console.error(`\n❌ API CONTRACT: missing rid source\n   ${file}\n`);
    failed = true;
    continue;
  }
  if (!passesApiContract(text)) {
    console.error(`\n❌ API CONTRACT: response helpers / shape\n   ${file}\n`);
    failed = true;
  }
}

if (failed) {
  console.error("\n⛔ api-contract-enforcer: fix routes above.\n");
  process.exit(1);
}

console.log(`\n✅ api-contract-enforcer: ${files.length} route.ts file(s) OK.\n`);
