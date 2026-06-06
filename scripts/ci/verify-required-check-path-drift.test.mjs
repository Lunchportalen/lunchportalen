#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { verifyRequiredCheckPathDrift } from "./verify-required-check-path-drift.mjs";

const root = resolve(import.meta.dirname, "../..");
const result = verifyRequiredCheckPathDrift({ cwd: root });

assert.equal(result.ok, true, JSON.stringify(result.mismatches, null, 2));

console.log(JSON.stringify({ ok: true, checks: Object.keys(result).length }, null, 2));
