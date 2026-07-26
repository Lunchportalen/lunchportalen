/**
 * Classify Supavisor pooler probe failures.
 * Timeout/network must NOT trigger Management API password rotate (shard races).
 */

export function isAuthFailure(error) {
  return /password authentication failed|SASL|invalid.?password|28P01|authentication failed/i.test(
    String(error || ""),
  );
}

export function isTransientPoolerError(error) {
  return /timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Connection terminated|too many clients|Connection refused|socket hang up|ETIMEDOUT/i.test(
    String(error || ""),
  );
}
