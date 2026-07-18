/**
 * Phase 17MENU.2D / #503: convert literal dotted keys under activity.events
 * into nested objects so next-intl path lookup matches eventKey dots.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "messages");
const DOTTED = [
  "provider.customer.restore.success",
  "provider.customer.restore.attempt",
  "provider.customer.archive.success",
  "provider.customer.hard_delete.success",
];

function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function findEventsNode(node, trail = []) {
  if (!node || typeof node !== "object") return null;
  if (node.events && typeof node.events === "object") {
    const ev = node.events;
    if (DOTTED.some((k) => Object.prototype.hasOwnProperty.call(ev, k))) {
      return { parent: node, events: ev, trail };
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === "object") {
      const hit = findEventsNode(v, [...trail, k]);
      if (hit) return hit;
    }
  }
  return null;
}

let fixed = 0;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const p = path.join(DIR, file);
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  const hit = findEventsNode(doc);
  if (!hit) continue;
  let changed = false;
  for (const key of DOTTED) {
    if (!Object.prototype.hasOwnProperty.call(hit.events, key)) continue;
    const value = hit.events[key];
    delete hit.events[key];
    setNested(hit.events, key, value);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    fixed += 1;
    console.log("fixed", file);
  }
}
console.log(JSON.stringify({ fixed_files: fixed }));
