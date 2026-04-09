/**
 * Thin alias for JSON fetch helpers used by tooling / optional call sites.
 *
 * Production transport with contract shape lives in `lib/api/client.ts` (`ApiResp`).
 * Throw-on-error JSON helpers live in `lib/core/fetchSafe.ts` (`fetchSafeJson`).
 *
 * Autofix architecture handlers do **not** bulk-replace `fetch(` with `apiFetch`.
 */
export { fetchSafeJson as apiFetch } from "@/lib/core/fetchSafe";
