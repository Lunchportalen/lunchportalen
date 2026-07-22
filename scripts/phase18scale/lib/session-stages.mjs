/**
 * Stage → minimum unique session identities for Phase 18SCALE controlled ramps.
 * SESSION_WRAP is forbidden for these stages under strict persisted-equality gates.
 */
export const SESSION_STAGE_TARGETS = Object.freeze({
  "smoke-100": 100,
  "smoke-500": 500,
  "ramp-1000": 1000,
  "ramp-5000": 5000,
  "ramp-10000": 10000,
});

export function resolveSessionStage(env = process.env) {
  const explicit = String(env.PHASE18_SESSION_STAGE || "").trim().toLowerCase();
  if (explicit && SESSION_STAGE_TARGETS[explicit] != null) return explicit;

  const wave = Number(env.PHASE18_HTTP_WAVE || 0);
  if (wave === 100) return "smoke-100";
  if (wave === 500) return "smoke-500";
  if (wave === 1000) return "ramp-1000";
  if (wave === 5000) return "ramp-5000";
  if (wave === 10000) return "ramp-10000";

  const target = Number(env.PHASE18_SESSION_TARGET || 0);
  if (target > 0) {
    const hit = Object.entries(SESSION_STAGE_TARGETS).find(([, n]) => n === target);
    if (hit) return hit[0];
  }
  return "smoke-100";
}

export function sessionTargetForStage(stage, env = process.env) {
  const override = Number(env.PHASE18_SESSION_TARGET || 0);
  if (override > 0) return override;
  const n = SESSION_STAGE_TARGETS[stage];
  if (!n) throw new Error(`PHASE18_UNKNOWN_SESSION_STAGE: ${stage}`);
  return n;
}

export function stageSessionsPath(evidenceDir, stage) {
  return `${evidenceDir.replace(/\\/g, "/").replace(/\/$/, "")}/sessions-${stage}.ndjson`;
}
