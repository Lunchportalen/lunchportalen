/**
 * Hard caps for stabilization — deterministic degradation under abuse.
 */

/** Max policy decision rows logged per control-tower request (matches max decisions/cycle). */
export const MAX_POLICY_DECISION_LOG_PER_REQUEST = 24;

/** Default timeout for health sub-probes (ms). */
export const HEALTH_SUBPROBE_TIMEOUT_MS = 8_000;

/** Default timeout for optional external-style awaits (ms). */
export const DEFAULT_ASYNC_TIMEOUT_MS = 25_000;
