/**
 * Forside / home page helpers for content editor.
 * Moved out of _stubs for a single, testable source of truth.
 */

import { parseJsonSafe, readApiError } from "./contentWorkspace.api";
import { safeStr } from "./contentWorkspace.helpers";

/** POST build-home-from-intent — ren transport; state settes av kaller (ContentWorkspace). */
export async function fetchBuildHomeFromRepoIntent(opts: {
  clearAutosaveTimer: () => void;
  setBuildHomeFromRepoBusy: (v: boolean) => void;
  setLastError: (msg: string | null) => void;
  setRefetchDetailKey: (fn: (k: number) => number) => void;
  router: { refresh: () => void };
}): Promise<void> {
  opts.clearAutosaveTimer();
  opts.setBuildHomeFromRepoBusy(true);
  try {
    const res = await fetch("/api/backoffice/ai/build-home-from-intent", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "Firmalunsj med kontroll og forutsigbarhet",
      }),
    });
    const payload = await parseJsonSafe<{ ok?: boolean; message?: string }>(res);
    if (!res.ok || payload?.ok !== true) {
      opts.setLastError(readApiError(res.status, payload, "Kunne ikke bygge forside fra repo."));
      return;
    }
    opts.setLastError(null);
    opts.setRefetchDetailKey((k) => k + 1);
    opts.router.refresh();
  } catch (err) {
    const msg = err instanceof Error ? safeStr(err.message) : "Kunne ikke bygge forside fra repo.";
    opts.setLastError(msg || "Kunne ikke bygge forside fra repo.");
  } finally {
    opts.setBuildHomeFromRepoBusy(false);
  }
}

export function getForsideBody(): { blocks: unknown[] } {
  return { blocks: [] };
}

export function isForside(slug: string, title: string): boolean {
  const sl = (slug ?? "").trim().toLowerCase();
  const t = (title ?? "").toLowerCase().trim();
  return (
    sl === "" ||
    sl === "/" ||
    sl === "index" ||
    sl === "home" ||
    sl === "hjem" ||
    sl === "front" ||
    sl === "forside" ||
    t === "forside" ||
    (t.includes("lunchportalen") && t.includes("firmalunsj"))
  );
}
