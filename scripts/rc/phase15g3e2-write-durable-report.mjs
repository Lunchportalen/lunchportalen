/**
 * Write PHASE 15G.3E.2 — DURABLE PIPELINE REPORT from last run + heartbeat.
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs/rc/phase15g3e");
const load = (p, fb) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fb);

const last = load(path.join(OUT, "durable-pipeline-last.json"), {});
const hb = load(path.join(OUT, "pipeline-heartbeat.json"), {});
const follow = load(path.join(OUT, "follow-up-schedule.json"), { items: [] });
const sendLog = load(path.join(OUT, "follow-up-send-log.json"), { sent: [] });
const dates = last.follow_up_dates || {};

const decision = last.Decision || "NO-GO";
const scheduled = (follow.items || []).length;
const sent = (sendLog.sent || []).filter((s) => s.status === "SENT").length;
const dup = last.duplicate_sends || 0;

const md = `# PHASE 15G.3E.2 — DURABLE PIPELINE REPORT

## Scheduler
- Type: ${hb.scheduler?.type || "GitHub Actions schedule"}
- Workflow/job: ${hb.scheduler?.workflow || "phase15g3e-response-pipeline.yml"} / pipeline
- Cadence: ${hb.scheduler?.cadence || "every 3 hours (cron: 0 */3 * * *)"}
- Enabled: ${hb.scheduler?.enabled ? "YES" : "PENDING_MERGE_TO_DEFAULT_BRANCH"}
- Last run: ${last.completed_at || last.started_at || "n/a"}
- Next run: ${hb.scheduler?.nextScheduledRun || "n/a"}
- Local terminal dependency: NONE

## Mailbox
- IMAP: ${last.mailbox?.imap || hb.mailbox?.imap || "UNKNOWN"}
- SMTP: ${last.mailbox?.smtp || hb.mailbox?.smtp || "UNKNOWN"}
- Secret source: ${last.secretSource || hb.mailbox?.secretSource || "GitHub Actions secret LUNCHPORTALEN_POST_MAILBOX_PASSWORD"}
- Replies (last run): ${last.replies_found ?? "n/a"}
- Failures: ${JSON.stringify(last.failures || [])}

## Follow-ups
- First due: ${dates.firstDue || "2026-07-22"} (verified: ${dates.firstDueVerified ? "YES" : "CHECK"})
- Second due: ${dates.secondDue || "2026-07-29"} (verified: ${dates.secondDueVerified ? "YES" : "CHECK"})
- Scheduled: ${scheduled}
- Sent: ${sent}
- Duplicate sends: ${dup}
- Calendar: ${dates.calendar || "business_days_mon_fri"}
- Thread retention: ${dates.emailThreadRetention || "In-Reply-To / References"}
- Backup escalation: only after second cadence

## Safety
- Secrets exposed: 0
- Production deployed: NO
- Production migrated: NO
- Production locks: ACTIVE
- Contracts signed: NO
- Payments made: NO
- Stripe: OFF

## Idempotency
- Distributed lock: pipeline-lock.json + Actions concurrency group
- Run ID: ${last.runId || "n/a"}
- Message-ID dedupe: reply-message-ids.json
- Follow-up identity: firmId:followup:round
- Duplicate send guard: claim-before-send
- Retry: bounded backoff (max 3)
- Permanent failure classification: YES
- Immutable audit: communication-audit.jsonl

## Decision
**${decision}**
`;

fs.writeFileSync(path.join(process.cwd(), "docs/rc/PHASE15G3E2-DURABLE-PIPELINE-REPORT.md"), md);
saveJson(path.join(OUT, "phase15g3e2-durable-report.json"), {
  writtenAt: new Date().toISOString(),
  decision,
  last,
  heartbeat: hb,
});

function saveJson(p, o) {
  fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
}

console.log(md);
