#!/usr/bin/env node
/**
 * Issue synthetic employee sessions (magic-link / password) for k6 waves.
 * Writes docs/rc/phase18scale/evidence/sessions.ndjson (tokens redacted in summary).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const MANIFEST = path.join(OUT, "employee-manifest.ndjson");
const SESSIONS = path.join(OUT, "sessions.ndjson");

async function main() {
  const { url } = loadPhase18Env();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password =
    process.env.PHASE18_SYNTH_PASSWORD ||
    `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
  process.env.PHASE18_SYNTH_PASSWORD = password;
  if (!fs.existsSync(MANIFEST)) throw new Error(`missing ${MANIFEST} — run seed-scale-matrix first`);

  const limit = Number(process.env.PHASE18_SESSION_LIMIT || 0); // 0 = all
  const concurrency = Number(process.env.PHASE18_SESSION_CONCURRENCY || 8);
  const out = fs.createWriteStream(SESSIONS);
  let issued = 0;
  let failed = 0;
  const queue = [];

  async function issueOne(row) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email });
    let session = null;
    if (!link.error && link.data?.properties?.hashed_token) {
      const verified = await anon.auth.verifyOtp({
        type: "email",
        token_hash: link.data.properties.hashed_token,
      });
      if (!verified.error) session = verified.data.session;
    }
    if (!session) {
      const pw = await anon.auth.signInWithPassword({ email: row.email, password });
      if (pw.error) throw new Error(pw.error.message);
      session = pw.data.session;
    }
    out.write(
      `${JSON.stringify({
        email: row.email,
        user_id: row.user_id,
        company_id: row.company_id,
        provider_id: row.provider_id,
        country: row.country,
        package: row.package,
        locale: row.locale,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })}\n`,
    );
    issued += 1;
  }

  const rl = readline.createInterface({ input: fs.createReadStream(MANIFEST), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (limit > 0 && issued + queue.length >= limit) break;
    const row = JSON.parse(line);
    queue.push(
      issueOne(row).catch((e) => {
        failed += 1;
        console.warn(`session fail ${row.email}: ${e.message}`);
      }),
    );
    if (queue.length >= concurrency) {
      await Promise.all(queue.splice(0, concurrency));
      if (issued % 500 === 0) console.log(`sessions issued=${issued} failed=${failed}`);
    }
  }
  await Promise.all(queue);
  out.end();
  const summary = {
    phase: "18SCALE",
    issued,
    failed,
    sessions_path: "sessions.ndjson",
    note: "Tokens are gitignored evidence — never commit.",
  };
  fs.writeFileSync(path.join(OUT, "issue-auth-sessions.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (issued === 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
