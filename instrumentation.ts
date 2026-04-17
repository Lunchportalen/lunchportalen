/**
 * Next.js server lifecycle hook — runs once per Node server process.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Dev control-plane scan (logDevControlPlaneSummary / logControlCoverageErrors) cannot be
 * imported here: the instrumentation bundle does not resolve Node core modules (fs/path).
 * Use `node scripts/verify-control-coverage.mjs` (also run at build start) for the same scan.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { initSupabaseServerHooks } = await import("@/lib/supabase/init");
    await initSupabaseServerHooks();
  } catch {
    /* non-fatal */
  }

  try {
    const g = globalThis as unknown as { __lp_shutdown_hooks?: boolean };
    if (!g.__lp_shutdown_hooks) {
      g.__lp_shutdown_hooks = true;
      const { markShutdown } = await import("@/lib/infra/shutdown");
      const onSig = () => {
        markShutdown();
      };
      process.on("SIGTERM", onSig);
      process.on("SIGINT", onSig);
    }
  } catch {
    /* non-fatal */
  }

}
