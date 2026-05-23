#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mergeEnvLocal } from '../smoke/merge-env-local.mjs';

function readKey(file, key) {
  if (!fs.existsSync(file)) return '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m || m[1] !== key) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return '';
}

function generateBypassSecret() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(32);
  let out = '';
  for (let i = 0; i < 32; i += 1) out += chars[bytes[i] % chars.length];
  return out;
}

const current = readKey('.env.local', 'VERCEL_AUTOMATION_BYPASS_SECRET');
const clean = current.replace(/[\r\n]+/g, '').trim();
const ok = /^[0-9a-zA-Z]{32,64}$/.test(clean);

console.log('local len', clean.length, 'prefix', clean.slice(0, 6), 'valid', ok);

if (!ok) {
  const secret = generateBypassSecret();
  mergeEnvLocal({ VERCEL_AUTOMATION_BYPASS_SECRET: secret });
  fs.writeFileSync('.dc028-secret.tmp', secret, 'utf8');
  console.log('regenerated len', secret.length, 'prefix', secret.slice(0, 6));
  process.exit(2);
}

if (clean !== current) {
  mergeEnvLocal({ VERCEL_AUTOMATION_BYPASS_SECRET: clean });
  console.log('trimmed whitespace from local secret');
}

fs.writeFileSync('.dc028-secret.tmp', clean, 'utf8');
