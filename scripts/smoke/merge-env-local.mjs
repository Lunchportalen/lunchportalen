#!/usr/bin/env node
/** Idempotent merge of key/value pairs into .env.local */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env.local");

function load(filePath) {
  if (!fs.existsSync(filePath)) return { lines: [], map: new Map() };
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return { lines, map };
}

function serialize(map) {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const raw = String(v ?? "");
      const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      const needsQuote = /[\s#"'\\]/.test(unquoted) || unquoted.includes("=");
      return `${k}=${needsQuote ? JSON.stringify(unquoted) : unquoted}`;
    })
    .join("\n");
}

export function mergeEnvLocal(updates) {
  const { map } = load(file);
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null && String(v).length > 0) map.set(k, String(v));
  }
  fs.writeFileSync(file, `${serialize(map)}\n`, "utf8");
}

if (process.argv[1]?.includes("merge-env-local.mjs")) {
  const updates = {};
  for (const arg of process.argv.slice(2)) {
    const i = arg.indexOf("=");
    if (i > 0) updates[arg.slice(0, i)] = arg.slice(i + 1);
  }
  mergeEnvLocal(updates);
  console.log("merged", Object.keys(updates).join(", "));
}
