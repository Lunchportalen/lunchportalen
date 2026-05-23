#!/usr/bin/env node
import fs from 'node:fs';

function readKey(file, key) {
  if (!fs.existsSync(file)) return '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith(`${key}=`)) continue;
    let v = line.slice(key.length + 1).trim();
    if (v.startsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        v = v.replace(/^"|"$/g, '');
      }
    }
    return v;
  }
  return '';
}

const local = readKey('.env.local', 'VERCEL_AUTOMATION_BYPASS_SECRET');
const remote = readKey('.env.staging-pull.tmp', 'VERCEL_AUTOMATION_BYPASS_SECRET');
console.log('local', local.length, local.slice(0, 6), 'newline', /[\r\n]/.test(local));
console.log('remote', remote.length, remote.slice(0, 6), 'newline', /[\r\n]/.test(remote));
console.log('match', local === remote);
