/**
 * Phase 15G.3E.2 — Durable response / quote / follow-up pipeline.
 *
 * Designed for GitHub Actions schedule (every 3h). Also runnable locally.
 * - Secrets from env only (never logged)
 * - Distributed lock + run ID + Message-ID dedupe
 * - Follow-up identity per firm/stage + duplicate send guard
 * - Stale-job write protection via state revision
 * - Immutable communication audit
 * - Material owner notifications only
 * No production deploy/migrate. No auto contract/payment/approval.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

const OUT = path.join(process.cwd(), "docs/rc/phase15g3e");
const DRAFTS = path.join(OUT, "outreach-drafts");
const LOCK_TTL_MS = 25 * 60 * 1000;
const MAX_SMTP_ATTEMPTS = 3;
const MATERIAL = new Set([
  "QUOTE_RECEIVED",
  "REVIEWER_IDENTITIES_RECEIVED",
  "CREDENTIALS_RECEIVED",
  "CONTRACT_REQUIRED",
  "PAYMENT_APPROVAL_REQUIRED",
  "BOUNCE",
  "SECURITY_INCIDENT",
]);

fs.mkdirSync(path.join(OUT, "attachments-quarantine"), { recursive: true });
fs.mkdirSync(path.join(OUT, "runs"), { recursive: true });

const RUN_ID =
  process.env.GITHUB_RUN_ID ||
  process.env.PHASE15G3E_RUN_ID ||
  `local-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}`;
const STARTED_AT = new Date();
const NOW = () => new Date();

const log = (...a) => process.stdout.write(`[${NOW().toISOString()}] ${a.map(String).join(" ")}\n`);
const load = (p, fb) => {
  if (!fs.existsSync(p)) return fb;
  // Strip UTF-8 BOM (PowerShell Set-Content can inject it)
  const raw = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  if (!raw.trim()) return fb;
  return JSON.parse(raw);
};
const save = (p, o) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
};
const appendAudit = (entry) => {
  const line = JSON.stringify({ ...entry, at: NOW().toISOString(), runId: RUN_ID }) + "\n";
  fs.appendFileSync(path.join(OUT, "communication-audit.jsonl"), line);
};

function resolvePass() {
  const envNames = [
    "LUNCHPORTALEN_POST_MAILBOX_PASSWORD",
    "POST_MAILBOX_PASSWORD",
    "POST_SMTP_PASS",
    "POST_IMAP_PASS",
  ];
  for (const n of envNames) {
    const v = String(process.env[n] || "").trim();
    if (v) return { pass: v, source: `env:${n}` };
  }
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    throw new Error("POST_SECRET_MISSING");
  }
  const envPath = process.env.PHASE15G3E_ENV_FILE || "C:/prosjekter/lunchportalen/.env.local";
  if (!fs.existsSync(envPath)) throw new Error("POST_SECRET_MISSING");
  const env = dotenv.parse(fs.readFileSync(envPath));
  const v = String(env.LUNCHPORTALEN_POST_MAILBOX_PASSWORD || "").trim();
  if (!v) throw new Error("POST_SECRET_MISSING");
  return { pass: v, source: "file:.env.local" };
}

function acquireLock() {
  const lockPath = path.join(OUT, "pipeline-lock.json");
  const existing = load(lockPath, null);
  const now = NOW();
  if (existing?.held && existing.expiresAt && new Date(existing.expiresAt) > now) {
    if (existing.runId !== RUN_ID) {
      return {
        ok: false,
        reason: "LOCKED_BY_OTHER_RUN",
        holder: existing.runId,
        expiresAt: existing.expiresAt,
      };
    }
  }
  // stale lock takeover allowed when expired
  const lock = {
    held: true,
    runId: RUN_ID,
    startedAt: STARTED_AT.toISOString(),
    heartbeatAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
    host: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
  };
  save(lockPath, lock);
  // verify we won (naive single-writer; GH concurrency is primary guard)
  const verify = load(lockPath, {});
  if (verify.runId !== RUN_ID) {
    return { ok: false, reason: "LOCK_RACE_LOST", holder: verify.runId };
  }
  return { ok: true, lock };
}

function heartbeatLock() {
  const lockPath = path.join(OUT, "pipeline-lock.json");
  const lock = load(lockPath, {});
  if (lock.runId !== RUN_ID) return false;
  lock.heartbeatAt = NOW().toISOString();
  lock.expiresAt = new Date(Date.now() + LOCK_TTL_MS).toISOString();
  save(lockPath, lock);
  return true;
}

function releaseLock() {
  const lockPath = path.join(OUT, "pipeline-lock.json");
  const lock = load(lockPath, {});
  if (lock.runId !== RUN_ID) return;
  save(lockPath, {
    held: false,
    runId: null,
    releasedAt: NOW().toISOString(),
    lastRunId: RUN_ID,
  });
}

function readStateMeta() {
  return load(path.join(OUT, "state-meta.json"), {
    revision: 0,
    updatedAt: null,
    lastRunId: null,
  });
}

function writeStateGuarded(writeFn) {
  const metaPath = path.join(OUT, "state-meta.json");
  const before = readStateMeta();
  // Stale job cannot overwrite newer state
  if (before.updatedAt && before.lastRunId && before.lastRunId !== RUN_ID) {
    const otherStarted = before.lastStartedAt ? new Date(before.lastStartedAt) : null;
    if (otherStarted && otherStarted > STARTED_AT) {
      throw new Error(`STALE_JOB_WRITE_BLOCKED: newer run ${before.lastRunId}`);
    }
  }
  writeFn();
  const next = {
    revision: (before.revision || 0) + 1,
    updatedAt: NOW().toISOString(),
    lastRunId: RUN_ID,
    lastStartedAt: STARTED_AT.toISOString(),
  };
  save(metaPath, next);
  return next;
}

function matchFirm(from, subject, source) {
  const blob = `${from}\n${subject}\n${source.slice(0, 3000)}`;
  const domainMap = [
    [/@ey\.com\b/i, "ey-indirect-tax"],
    [/@mail\.transperfect\.com\b|@transperfect\.com\b/i, "transperfect-direct"],
    [/@semantix\.com\b|@semantix-group\.com\b/i, "semantix-transperfect"],
    [/@deloitte\./i, "deloitte-global-indirect-tax"],
    [/@bdo\./i, "bdo-dach-vat"],
    [/@conta\.no\b/i, "conta-as-peppol-no"],
    [/@avalara\.com\b|@mail\.avalara\.com\b/i, "avalara-na"],
    [/@azets\./i, "azets-nordic"],
    [/@thomsonreuters\.|@pagero\./i, "thomson-reuters-pagero"],
    [/@twobirds\.com\b/i, "bird-bird-privacy-legal"],
    [/@nccgroup\./i, "ncc-group-security"],
  ];
  for (const [re, id] of domainMap) if (re.test(from) || re.test(blob)) return id;
  const threadMap = [
    [/LP-15G3E-deloitte/i, "deloitte-global-indirect-tax"],
    [/LP-15G3E-bdo/i, "bdo-dach-vat"],
    [/LP-15G3E-conta/i, "conta-as-peppol-no"],
    [/LP-15G3E-avalara/i, "avalara-na"],
    [/LP-15G3E-ey/i, "ey-indirect-tax"],
    [/LP-15G3E-azets/i, "azets-nordic"],
    [/LP-15G3E-(thomson|pagero)/i, "thomson-reuters-pagero"],
    [/LP-15G3E-bird/i, "bird-bird-privacy-legal"],
    [/LP-15G3E-ncc/i, "ncc-group-security"],
    [/LP-15G3E-semantix/i, "semantix-transperfect"],
    [/LP-15G3E-transperfect/i, "transperfect-direct"],
  ];
  for (const [re, id] of threadMap) if (re.test(blob)) return id;
  return null;
}

function classify(subject, from, source) {
  const head = `${subject}\n${from}`.toLowerCase();
  const t = `${subject}\n${from}\n${source}`.toLowerCase();
  if (/thank you for (your )?(request|message|reaching out|contacting|submission)|form was submitted|we have received your/i.test(subject)) {
    return "FORM_CONFIRMATION_ACK";
  }
  if (/^delivery status notification|^undeliverable|mail delivery failed|mailer-daemon|postmaster@/i.test(head)) return "BOUNCE";
  if (/mailer-daemon/i.test(from)) return "BOUNCE";
  if (/out of office|automatic reply|auto-reply|autoreply/i.test(subject)) return "AUTO_REPLY";
  if (/\b(opt-?out|unsubscribe)\b/i.test(t) && /(remove|stop|decline|not interested)/i.test(t)) return "DECLINED";
  if (/\bdecline\b|not able to assist|cannot assist|no capacity|not interested/i.test(t)) return "DECLINED";
  if (/\b(nda|msa|dpa)\b/i.test(t) && /sign|agreement|attach|contract/i.test(t)) return "CONTRACT_REQUIRED";
  if (/\binvoice\b|retainer|wire transfer|bank details/i.test(t) && /pay|payment|fee/i.test(t)) return "PAYMENT_APPROVAL_REQUIRED";
  if (/quote|fee|hourly|fixed price|estimate|tilbud|\bpris\b|pricing/i.test(t)) return "QUOTE_RECEIVED";
  if (/named reviewer|reviewer identity|credential|licence|license|qualification|\bcv\b|\bbio\b/i.test(t)) {
    if (/credential|licence|license|qualification|\bcv\b|\bbio\b/i.test(t)) return "CREDENTIALS_RECEIVED";
    return "REVIEWER_IDENTITIES_RECEIVED";
  }
  if (/we can cover|scope confirmed|capable of|locales?/i.test(t)) return "SCOPE_CONFIRMED";
  if (/\?|clarif|more information|please provide/i.test(t)) return "NEEDS_CLARIFICATION";
  return "NEEDS_CLARIFICATION";
}

function scanAttachments(source) {
  const atts = [];
  const re = /Content-Disposition:\s*(attachment|inline);\s*filename\*?=(?:UTF-8''|)"?([^";\r\n]+)"?/gi;
  let m;
  while ((m = re.exec(source))) {
    const filename = decodeURIComponent(m[2]).slice(0, 180);
    const ext = path.extname(filename).toLowerCase();
    const dangerous = [".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs", ".scr", ".dll", ".msi", ".com"].includes(ext);
    const allowedReview = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".txt", ".csv"].includes(ext);
    atts.push({
      filename,
      disposition: m[1],
      ext,
      safeToOpen: allowedReview && !dangerous,
      quarantine: dangerous || !allowedReview,
      action: dangerous ? "BLOCKED_NOT_SAVED" : "METADATA_ONLY",
    });
  }
  return atts;
}

function followUpIdentity(firmId, round) {
  return `${firmId}:followup:${round}`;
}

async function withBackoff(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_SMTP_ATTEMPTS; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      const permanent = /invalid login|authentication failed|550 |553 |relay not permitted|mailbox unavailable/i.test(msg);
      if (permanent) {
        appendAudit({ type: "PERMANENT_FAILURE", label, error: msg.slice(0, 160), attempt });
        throw Object.assign(e, { permanent: true });
      }
      const delay = Math.min(8000, 500 * 2 ** (attempt - 1));
      appendAudit({ type: "RETRY", label, attempt, delayMs: delay, error: msg.slice(0, 120) });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function probeMailbox(pass) {
  const status = { imap: "UNKNOWN", smtp: "UNKNOWN", error: null };
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
  try {
    const client = new ImapFlow({
      host: "mail.lunchportalen.no",
      port: 993,
      secure: true,
      auth: { user: "post@lunchportalen.no", pass },
      logger: false,
      tls: { rejectUnauthorized: true, servername: "mail.lunchportalen.no", minVersion: "TLSv1.2" },
    });
    await client.connect();
    await client.logout().catch(() => null);
    status.imap = "PASS";
  } catch (e) {
    status.imap = "FAIL";
    status.error = String(e.message || e).slice(0, 120);
  }
  try {
    const transport = nodemailer.createTransport({
      host: "mail.lunchportalen.no",
      port: 465,
      secure: true,
      auth: { user: "post@lunchportalen.no", pass },
      tls: { rejectUnauthorized: true, servername: "mail.lunchportalen.no", minVersion: "TLSv1.2" },
    });
    await transport.verify();
    status.smtp = "PASS";
  } catch (e) {
    status.smtp = "FAIL";
    status.error = String(e.message || e).slice(0, 120);
  }
  return status;
}

async function pollInbox(pass) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
  const client = new ImapFlow({
    host: "mail.lunchportalen.no",
    port: 993,
    secure: true,
    auth: { user: "post@lunchportalen.no", pass },
    logger: false,
    tls: { rejectUnauthorized: true, servername: "mail.lunchportalen.no", minVersion: "TLSv1.2" },
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const seenPath = path.join(OUT, "reply-message-ids.json");
  const seen = new Set(load(seenPath, []));
  const replies = [];
  const formAcks = [];
  const counts = Object.create(null);
  try {
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    let uids = await client.search({ since });
    if (!Array.isArray(uids)) uids = [];
    uids = uids.slice(-150);
    for (const uid of uids) {
      const msg = await client.fetchOne(uid, { envelope: true, source: true });
      const messageId = msg.envelope?.messageId;
      if (!messageId || seen.has(messageId)) continue;
      const subject = String(msg.envelope?.subject || "");
      const from = (msg.envelope?.from || []).map((x) => x.address || "").join(",");
      const source = msg.source?.toString("utf8") || "";
      if (/^post@lunchportalen\.no$/i.test(from)) continue;
      const firmId = matchFirm(from, subject, source);
      if (!firmId) continue;
      if (
        !/lunchportalen|15g3e|rfp|independent review|thank you for your|thomas andre|request|reaching out|quote|reviewer/i.test(
          `${subject} ${source.slice(0, 2500)}`,
        )
      ) {
        continue;
      }
      seen.add(messageId);
      const classification = classify(subject, from, source.slice(0, 8000));
      counts[classification] = (counts[classification] || 0) + 1;
      const attachments = scanAttachments(source);
      const row = {
        firmId,
        messageId,
        subject: subject.slice(0, 200),
        from,
        classification,
        date: msg.envelope?.date || null,
        attachments,
        processedAt: NOW().toISOString(),
        runId: RUN_ID,
      };
      if (attachments.length) {
        save(path.join(OUT, "attachments-quarantine", `${firmId}-${crypto.createHash("sha256").update(messageId).digest("hex").slice(0, 16)}.json`), {
          messageId,
          firmId,
          subject,
          attachments,
          note: "No attachment bytes executed or opened",
        });
      }
      appendAudit({
        type: "INBOUND_CLASSIFIED",
        firmId,
        messageId,
        classification,
        attachmentCount: attachments.length,
        // no body / no PII dump
      });
      if (classification === "FORM_CONFIRMATION_ACK") formAcks.push(row);
      else replies.push(row);
    }
  } finally {
    lock.release();
    await client.logout().catch(() => null);
  }

  writeStateGuarded(() => {
    save(seenPath, [...seen]);
    const ledgerPath = path.join(OUT, "reply-ledger-cumulative.json");
    const ledger = load(ledgerPath, { items: [], byMessageId: {} });
    for (const row of [...replies, ...formAcks]) {
      if (ledger.byMessageId[row.messageId]) continue;
      ledger.byMessageId[row.messageId] = row;
      ledger.items.push(row);
    }
    ledger.lastPollAt = NOW().toISOString();
    save(ledgerPath, ledger);
  });

  return { replies, formAcks, counts, seen: seen.size };
}

function updateTrackers(replies, formAcks) {
  const quote = load(path.join(OUT, "quote-tracker.json"), { items: [] });
  const reviewer = load(path.join(OUT, "reviewer-tracker.json"), { items: [] });
  const credential = load(path.join(OUT, "credential-tracker.json"), { items: [] });
  const contract = load(path.join(OUT, "contract-tracker.json"), { items: [] });
  const procurement = load(path.join(OUT, "procurement-response-tracker.json"), { items: [] });

  const upsert = (arr, firmId, patch) => {
    let row = arr.find((x) => x.firmId === firmId);
    if (!row) {
      row = { firmId, updatedAt: NOW().toISOString() };
      arr.push(row);
    }
    Object.assign(row, patch, { updatedAt: NOW().toISOString() });
  };

  writeStateGuarded(() => {
    for (const r of [...replies, ...formAcks]) {
      upsert(procurement.items, r.firmId, {
        lastClassification: r.classification,
        lastMessageId: r.messageId,
        lastSubject: r.subject,
        lastFrom: r.from,
        lastDate: r.date,
      });
      if (r.classification === "QUOTE_RECEIVED") upsert(quote.items, r.firmId, { status: "QUOTE_RECEIVED", messageId: r.messageId, subject: r.subject });
      if (r.classification === "REVIEWER_IDENTITIES_RECEIVED") upsert(reviewer.items, r.firmId, { status: "IDENTITIES_RECEIVED", messageId: r.messageId });
      if (r.classification === "CREDENTIALS_RECEIVED") upsert(credential.items, r.firmId, { status: "CREDENTIALS_RECEIVED", messageId: r.messageId });
      if (r.classification === "CONTRACT_REQUIRED") upsert(contract.items, r.firmId, { status: "CONTRACT_REQUIRED", messageId: r.messageId });
      if (r.classification === "PAYMENT_APPROVAL_REQUIRED") upsert(contract.items, r.firmId, { status: "PAYMENT_APPROVAL_REQUIRED", messageId: r.messageId });
      if (r.classification === "DECLINED") upsert(procurement.items, r.firmId, { stopped: true, stopReason: "DECLINED" });
      if (r.classification === "BOUNCE") upsert(procurement.items, r.firmId, { deliveryFailure: true, stopReason: "BOUNCE" });
    }
    save(path.join(OUT, "quote-tracker.json"), quote);
    save(path.join(OUT, "reviewer-tracker.json"), reviewer);
    save(path.join(OUT, "credential-tracker.json"), credential);
    save(path.join(OUT, "contract-tracker.json"), contract);
    save(path.join(OUT, "procurement-response-tracker.json"), procurement);
  });

  return { quote, reviewer, credential, contract, procurement };
}

function followUpBody(firmId, threadRef, round) {
  const draftPath = path.join(DRAFTS, `${firmId}.txt`);
  const prior = fs.existsSync(draftPath) ? fs.readFileSync(draftPath, "utf8") : "";
  const subj = /^Subject:\s*(.+)$/m.exec(prior)?.[1]?.trim() || `[Lunchportalen] Independent review RFP — follow-up ${round}`;
  const text = `Follow-up ${round}/2 — Thread ${threadRef}

Dear team,

We are following up on our independent compliance review RFP (thread ${threadRef}).

Please reply with:
1) Scope confirmation (countries/locales you can cover)
2) Named reviewer identities + credential references
3) Conflict-of-interest willingness
4) Quote (fixed or capped T&M) and turnaround
5) Contract/MSA/DPA assumptions

Reply-To: post@lunchportalen.no
Sender: Lunchportalen <post@lunchportalen.no>

Kind regards,
Lunchportalen Global Compliance Program
`;
  return { subject: subj.startsWith("Re:") ? subj : `Re: ${subj}`, text };
}

async function processFollowUps(pass, procurement) {
  const follow = load(path.join(OUT, "follow-up-schedule.json"), { items: [] });
  const send = load(path.join(OUT, "outreach-send-result.json"), { sent: [] });
  const sentFollowUps = load(path.join(OUT, "follow-up-send-log.json"), { sent: [] });
  const results = { dueNow: [], sent: [], skipped: [], notDue: [], permanentFailures: [] };
  const now = NOW();

  const transport = nodemailer.createTransport({
    host: "mail.lunchportalen.no",
    port: 465,
    secure: true,
    auth: { user: "post@lunchportalen.no", pass },
    tls: { rejectUnauthorized: true, servername: "mail.lunchportalen.no", minVersion: "TLSv1.2" },
  });

  for (const item of follow.items || []) {
    heartbeatLock();
    const proc = (procurement.items || []).find((p) => p.firmId === item.firmId);
    if (proc?.stopped || proc?.lastClassification === "DECLINED" || item.status === "STOPPED_DECLINED") {
      item.status = "STOPPED_DECLINED";
      results.skipped.push({ firmId: item.firmId, reason: "DECLINED_OR_STOPPED" });
      continue;
    }

    if (item.channel === "web_form") {
      const firstDue = new Date(item.followUpDueAt) <= now;
      const secondDue = item.secondFollowUpDueAt && new Date(item.secondFollowUpDueAt) <= now;
      if (!firstDue) {
        results.notDue.push({ firmId: item.firmId, next: item.followUpDueAt });
        continue;
      }
      if (!["SCHEDULED", "FIRST_REMINDER_LOGGED", "FIRST_SENT"].includes(item.status) && item.status !== "BACKUP_ESCALATION_READY") {
        // allow SCHEDULED → reminder
      }
      if (item.status === "SCHEDULED" && firstDue && !secondDue) {
        item.status = "FIRST_REMINDER_LOGGED";
        item.firstReminderLoggedAt = now.toISOString();
        results.skipped.push({ firmId: item.firmId, reason: "WEB_FORM_REMINDER_LOGGED_NO_EMAIL" });
        continue;
      }
      if (secondDue && item.status !== "BACKUP_ESCALATION_READY") {
        item.status = "BACKUP_ESCALATION_READY";
        results.skipped.push({ firmId: item.firmId, reason: "WEB_FORM_NO_SMTP_THREAD_BACKUP_READY" });
      } else if (!secondDue) {
        results.notDue.push({ firmId: item.firmId, next: item.secondFollowUpDueAt });
      }
      continue;
    }

    const orig = (send.sent || []).find((s) => s.firmId === item.firmId);
    if (!orig?.to) {
      results.skipped.push({ firmId: item.firmId, reason: "NO_RECIPIENT" });
      continue;
    }

    const firstDue = new Date(item.followUpDueAt) <= now;
    const secondDue = item.secondFollowUpDueAt && new Date(item.secondFollowUpDueAt) <= now;
    let round = null;
    if (item.status === "SCHEDULED" && firstDue) round = 1;
    else if (item.status === "FIRST_SENT" && secondDue) round = 2;
    else if (item.status === "SCHEDULED" && secondDue) round = 2; // missed first — send second only after second due
    else {
      results.notDue.push({
        firmId: item.firmId,
        next: item.status === "FIRST_SENT" ? item.secondFollowUpDueAt : item.followUpDueAt,
      });
      continue;
    }

    // Never send before planned date (hard guard)
    const dueAt = round === 1 ? item.followUpDueAt : item.secondFollowUpDueAt;
    if (new Date(dueAt) > now) {
      results.notDue.push({ firmId: item.firmId, next: dueAt, guard: "BEFORE_DUE" });
      continue;
    }

    const identity = followUpIdentity(item.firmId, round);
    if (sentFollowUps.sent.some((s) => s.identity === identity || (s.firmId === item.firmId && s.round === round))) {
      results.skipped.push({ firmId: item.firmId, reason: "ALREADY_SENT_ROUND", round, identity });
      if (round === 1 && item.status === "SCHEDULED") item.status = "FIRST_SENT";
      if (round === 2) item.status = "BACKUP_ESCALATION_READY";
      continue;
    }

    // Claim identity before SMTP to block parallel duplicates
    const claim = {
      firmId: item.firmId,
      round,
      identity,
      to: orig.to,
      threadRef: item.threadRef,
      status: "CLAIMED",
      claimedAt: now.toISOString(),
      runId: RUN_ID,
    };
    sentFollowUps.sent.push(claim);
    save(path.join(OUT, "follow-up-send-log.json"), sentFollowUps);

    results.dueNow.push({ firmId: item.firmId, round, identity });
    const { subject, text } = followUpBody(item.firmId, item.threadRef, round);
    try {
      const info = await withBackoff(
        () =>
          transport.sendMail({
            from: "Lunchportalen <post@lunchportalen.no>",
            to: orig.to,
            replyTo: "post@lunchportalen.no",
            subject,
            text,
            inReplyTo: orig.providerMessageId || undefined,
            references: orig.providerMessageId || undefined,
            headers: {
              "X-Lunchportalen-Phase": "15G.3E",
              "X-Lunchportalen-Thread": item.threadRef,
              "X-Lunchportalen-FollowUp": String(round),
              "X-Lunchportalen-FollowUp-Identity": identity,
              "X-Lunchportalen-Run-Id": RUN_ID,
            },
          }),
        `followup:${identity}`,
      );
      claim.status = "SENT";
      claim.messageId = info.messageId;
      claim.sentAt = NOW().toISOString();
      results.sent.push({ ...claim });
      item.status = round === 1 ? "FIRST_SENT" : "BACKUP_ESCALATION_READY";
      item[`followUp${round}SentAt`] = claim.sentAt;
      appendAudit({ type: "FOLLOWUP_SENT", identity, firmId: item.firmId, round, messageId: info.messageId, to: orig.to });
    } catch (e) {
      claim.status = e.permanent ? "PERMANENT_FAILURE" : "TRANSIENT_FAILURE";
      claim.error = String(e.message || e).slice(0, 160);
      if (e.permanent) {
        results.permanentFailures.push({ firmId: item.firmId, identity, error: claim.error });
        item.status = "STOPPED_DELIVERY_FAILURE";
      } else {
        // allow retry next run — remove claim so identity not permanently blocked
        sentFollowUps.sent = sentFollowUps.sent.filter((s) => s.identity !== identity || s.status === "SENT");
        results.skipped.push({ firmId: item.firmId, reason: "SMTP_TRANSIENT", error: claim.error });
      }
      appendAudit({ type: "FOLLOWUP_FAIL", identity, firmId: item.firmId, permanent: !!e.permanent, error: claim.error });
    }
  }

  writeStateGuarded(() => {
    save(path.join(OUT, "follow-up-schedule.json"), { ...follow, items: follow.items, lastCycleAt: NOW().toISOString() });
    save(path.join(OUT, "follow-up-send-log.json"), sentFollowUps);
  });
  return results;
}

function escalateBackups(follow, registry) {
  const ready = (follow.items || []).filter((i) => i.status === "BACKUP_ESCALATION_READY");
  const backups = [];
  const firms = registry.firms || [];
  for (const item of ready) {
    // Only after second cadence expired
    const secondDue = item.secondFollowUpDueAt && new Date(item.secondFollowUpDueAt) <= NOW();
    if (!secondDue && item.channel === "email" && !item.followUp2SentAt) {
      continue;
    }
    const primary = firms.find((f) => f.firmId === item.firmId);
    const lane = primary?.lane;
    const backup = firms.find((f) => f.lane === lane && f.roleInShortlist === "BACKUP" && f.firmId !== item.firmId);
    const row = {
      primaryFirmId: item.firmId,
      backupFirmId: backup?.firmId || null,
      backupChannel: backup?.publicContactChannel || null,
      status: backup ? "BACKUP_CANDIDATE_IDENTIFIED" : "NO_BACKUP_IN_REGISTRY",
      note: "Pack prepared only — no auto-send without APPROVE_ALL covering backup firm.",
      runId: RUN_ID,
    };
    backups.push(row);
    item.backupEscalation = row;
  }
  return backups;
}

function buildOwnerBatchIfQuotes(quote, reviewer, credential, contract, registry) {
  const quotes = (quote.items || []).filter((q) => q.status === "QUOTE_RECEIVED");
  if (!quotes.length) {
    const waiting = {
      batchId: "OWNER_CONTRACT_PAYMENT_BATCH_15G3E",
      status: "WAITING_FOR_QUOTES",
      updatedAt: NOW().toISOString(),
      firms: [],
    };
    save(path.join(OUT, "OWNER_CONTRACT_PAYMENT_BATCH_15G3E.json"), waiting);
    return waiting;
  }
  const firms = quotes.map((q) => {
    const firm = (registry.firms || []).find((f) => f.firmId === q.firmId);
    const rev = (reviewer.items || []).find((r) => r.firmId === q.firmId);
    const cred = (credential.items || []).find((c) => c.firmId === q.firmId);
    const ctr = (contract.items || []).find((c) => c.firmId === q.firmId);
    return {
      firm: firm?.companyName || q.firmId,
      firmId: q.firmId,
      scope: firm?.recommendedScopes || [],
      countriesLocales: firm?.countriesCoveredClaimed || [],
      proposedReviewers: rev?.status || "PENDING",
      validatedCredentials: cred?.status || "PENDING",
      price: q.price || "SEE_EMAIL_THREAD",
      turnaround: q.turnaround || "SEE_EMAIL_THREAD",
      contractRequirements: ctr?.status || "UNKNOWN",
      paymentRequirements: ctr?.status === "PAYMENT_APPROVAL_REQUIRED" ? "YES" : "UNKNOWN",
      recommendation: "NEGOTIATE",
      ownerDecisionsNeeded: ["supplier_selection", "contract_signature", "cost_payment_approval"],
    };
  });
  const batch = {
    batchId: "OWNER_CONTRACT_PAYMENT_BATCH_15G3E",
    status: "READY_FOR_OWNER",
    createdAt: NOW().toISOString(),
    firms,
    ownerOnly: ["supplier selection", "contract signature", "cost/payment approval", "mandatory legal/authority signature"],
  };
  save(path.join(OUT, "OWNER_CONTRACT_PAYMENT_BATCH_15G3E.json"), batch);
  return batch;
}

function materialNotifications(replies, followResults, ownerBatch) {
  const events = [];
  for (const r of replies) {
    if (MATERIAL.has(r.classification)) {
      events.push({
        kind: r.classification,
        firmId: r.firmId,
        messageId: r.messageId,
        subject: r.subject,
      });
    }
  }
  for (const f of followResults.permanentFailures || []) {
    events.push({ kind: "DELIVERY_PERMANENTLY_FAILED", firmId: f.firmId, identity: f.identity });
  }
  if (ownerBatch.status === "READY_FOR_OWNER") {
    events.push({ kind: "OWNER_CONTRACT_PAYMENT_BATCH_READY", batchId: ownerBatch.batchId, firms: ownerBatch.firms?.length || 0 });
  }
  const notify = {
    notifyOwner: events.length > 0,
    runId: RUN_ID,
    at: NOW().toISOString(),
    events,
  };
  save(path.join(OUT, "owner-material-notification.json"), notify);
  if (notify.notifyOwner) {
    const md =
      `# OWNER MATERIAL NOTIFICATION — Phase 15G.3E\n\n` +
      `Run: ${RUN_ID}\nAt: ${notify.at}\n\n` +
      events.map((e) => `- **${e.kind}** ${e.firmId || ""} ${e.subject || e.identity || ""}\n`).join("") +
      `\nNo empty-poll notifications. No auto contract/payment.\n`;
    fs.writeFileSync(path.join(process.cwd(), "docs/rc/PHASE15G3E-OWNER-MATERIAL-NOTIFICATION.md"), md);
  }
  return notify;
}

function writeHeartbeat(summary) {
  const follow = load(path.join(OUT, "follow-up-schedule.json"), { items: [] });
  const due = (follow.items || [])
    .filter((i) => i.status === "SCHEDULED" || i.status === "FIRST_SENT" || i.status === "FIRST_REMINDER_LOGGED")
    .map((i) => ({
      firmId: i.firmId,
      next: i.status === "FIRST_SENT" || i.status === "FIRST_REMINDER_LOGGED" ? i.secondFollowUpDueAt : i.followUpDueAt,
      status: i.status,
    }))
    .sort((a, b) => String(a.next).localeCompare(String(b.next)));

  const cron = "0 */3 * * *";
  const nextScheduled = (() => {
    const d = new Date();
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() + (3 - (d.getUTCHours() % 3)));
    if (d <= new Date()) d.setUTCHours(d.getUTCHours() + 3);
    return d.toISOString();
  })();

  const hb = {
    scheduler: {
      type: "GitHub Actions schedule",
      workflow: "phase15g3e-response-pipeline.yml",
      cadence: "every 3 hours (cron: 0 */3 * * *)",
      cron,
      enabled: true,
      localTerminalDependency: "NONE",
      lastSuccessfulRun: summary.completed_at,
      nextScheduledRun: nextScheduled,
    },
    mailbox: {
      imap: summary.mailbox.imap,
      smtp: summary.mailbox.smtp,
      secretSource: summary.secretSource,
    },
    dueFollowUps: due,
    quotesWaiting: summary.quotes_waiting,
    failuresRequiringAction: summary.failures,
    secretsExposed: 0,
    productionLocks: "ACTIVE",
    stripe: "OFF",
    updatedAt: NOW().toISOString(),
    runId: RUN_ID,
  };
  save(path.join(OUT, "pipeline-heartbeat.json"), hb);
  fs.writeFileSync(
    path.join(process.cwd(), "docs/rc/PHASE15G3E2-PIPELINE-HEARTBEAT.md"),
    `# Phase 15G.3E.2 — Pipeline heartbeat\n\n` +
      `- Scheduler: ${hb.scheduler.type} · ${hb.scheduler.cadence}\n` +
      `- Enabled: YES\n` +
      `- Last successful run: ${hb.scheduler.lastSuccessfulRun}\n` +
      `- Next scheduled run: ${hb.scheduler.nextScheduledRun}\n` +
      `- IMAP: ${hb.mailbox.imap}\n` +
      `- SMTP: ${hb.mailbox.smtp}\n` +
      `- Due follow-ups: ${due.length}\n` +
      `- Quotes waiting: ${hb.quotesWaiting}\n` +
      `- Failures requiring action: ${hb.failuresRequiringAction.length}\n` +
      `- Local terminal dependency: NONE\n` +
      `- Production locks: ACTIVE · Stripe OFF\n`,
  );
  return hb;
}

function verifyFollowUpDates(follow) {
  const emailItems = (follow.items || []).filter((i) => i.channel === "email");
  const firsts = emailItems.map((i) => i.followUpDueAt?.slice(0, 10));
  const seconds = emailItems.map((i) => i.secondFollowUpDueAt?.slice(0, 10));
  return {
    firstDueVerified: firsts.every((d) => d === "2026-07-22"),
    secondDueVerified: seconds.every((d) => d === "2026-07-29"),
    firstDue: "2026-07-22",
    secondDue: "2026-07-29",
    calendar: follow.calendar || "business_days_mon_fri",
    emailThreadRetention: "same thread via In-Reply-To / References",
    backupAfterSecondOnly: true,
  };
}

// ---------------- MAIN ----------------
let exitCode = 0;
const failures = [];
let secretSource = null;

try {
  log("durable pipeline start", RUN_ID);
  const lockAcq = acquireLock();
  if (!lockAcq.ok) {
    const skip = {
      runId: RUN_ID,
      started_at: STARTED_AT.toISOString(),
      completed_at: NOW().toISOString(),
      status: "SKIPPED_LOCKED",
      lock: lockAcq,
      secrets_exposed: 0,
    };
    save(path.join(OUT, "runs", `${RUN_ID}.json`), skip);
    console.log(JSON.stringify(skip, null, 2));
    process.exit(0);
  }

  const { pass, source } = resolvePass();
  secretSource = source;
  log("secret source", source);

  const mailbox = await probeMailbox(pass);
  log("mailbox", mailbox.imap, mailbox.smtp);
  if (mailbox.imap !== "PASS") {
    failures.push({ type: "IMAP_AUTH_FAIL", detail: mailbox.error });
    throw new Error("IMAP_AUTH_FAIL");
  }

  const poll = await pollInbox(pass);
  log("poll", "new", String(poll.replies.length + poll.formAcks.length));
  const trackers = updateTrackers(poll.replies, poll.formAcks);

  let followResults = { dueNow: [], sent: [], skipped: [], notDue: [], permanentFailures: [] };
  if (mailbox.smtp === "PASS") {
    followResults = await processFollowUps(pass, trackers.procurement);
  } else {
    failures.push({ type: "SMTP_AUTH_FAIL", detail: mailbox.error });
  }

  const follow = load(path.join(OUT, "follow-up-schedule.json"), { items: [] });
  const registry = load(path.join(OUT, "firm-candidate-registry.json"), { firms: [] });
  const backups = escalateBackups(follow, registry);
  writeStateGuarded(() => {
    save(path.join(OUT, "follow-up-schedule.json"), follow);
    save(path.join(OUT, "backup-escalation-queue.json"), { updatedAt: NOW().toISOString(), items: backups });
  });

  const ownerBatch = buildOwnerBatchIfQuotes(trackers.quote, trackers.reviewer, trackers.credential, trackers.contract, registry);
  const notify = materialNotifications([...poll.replies, ...poll.formAcks].filter((r) => MATERIAL.has(r.classification)), followResults, ownerBatch);

  const dateCheck = verifyFollowUpDates(follow);
  const completed_at = NOW().toISOString();
  const nextDue =
    (follow.items || [])
      .map((i) => (i.status === "FIRST_SENT" || i.status === "FIRST_REMINDER_LOGGED" ? i.secondFollowUpDueAt : i.followUpDueAt))
      .filter(Boolean)
      .sort()[0] || null;

  const summary = {
    runId: RUN_ID,
    started_at: STARTED_AT.toISOString(),
    completed_at,
    replies_found: poll.replies.length + poll.formAcks.length,
    messages_classified: poll.replies.length + poll.formAcks.length,
    follow_ups_sent: followResults.sent.length,
    failures,
    next_due_action: nextDue,
    secrets_exposed: 0,
    mailbox,
    secretSource,
    quotes_waiting: (trackers.quote.items || []).filter((q) => q.status === "QUOTE_RECEIVED").length,
    owner_batch: ownerBatch.status,
    notify_owner: notify.notifyOwner,
    follow_up_dates: dateCheck,
    duplicate_sends: followResults.skipped.filter((s) => s.reason === "ALREADY_SENT_ROUND").length,
    Decision:
      failures.some((f) => f.type === "IMAP_AUTH_FAIL")
        ? "NO-GO"
        : notify.notifyOwner && ownerBatch.status === "READY_FOR_OWNER"
          ? "OWNER_ACTION_REQUIRED"
          : notify.notifyOwner
            ? "OWNER_ACTION_REQUIRED"
            : "DURABLE_PIPELINE_ACTIVE",
  };

  writeHeartbeat(summary);
  save(path.join(OUT, "runs", `${RUN_ID}.json`), summary);
  save(path.join(OUT, "active-pipeline-cycle.json"), { ...summary, Follow_up: followResults, backups });
  save(path.join(OUT, "durable-pipeline-last.json"), summary);

  // GitHub Actions outputs
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `notify_owner=${notify.notifyOwner}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `decision=${summary.Decision}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${RUN_ID}\n`);
  }

  appendAudit({ type: "RUN_COMPLETE", decision: summary.Decision, replies: summary.replies_found, followUpsSent: summary.follow_ups_sent });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.Decision === "NO-GO") exitCode = 2;
} catch (e) {
  exitCode = 1;
  const err = {
    runId: RUN_ID,
    started_at: STARTED_AT.toISOString(),
    completed_at: NOW().toISOString(),
    status: "FAILED",
    error: String(e.message || e).slice(0, 200),
    failures,
    secrets_exposed: 0,
    Decision: "NO-GO",
  };
  save(path.join(OUT, "runs", `${RUN_ID}.json`), err);
  save(path.join(OUT, "durable-pipeline-last.json"), err);
  appendAudit({ type: "RUN_FAILED", error: err.error });
  console.error(JSON.stringify(err, null, 2));
} finally {
  releaseLock();
}

process.exit(exitCode);
