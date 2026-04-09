// STATUS: KEEP

import { getSuperadminHealth } from "@/lib/superadmin/queries";

function chip(ok: boolean) {
  return ok ? "lp-chip lp-chip-ok" : "lp-chip lp-chip-crit";
}

export default async function SystemHealth() {
  const h = await getSuperadminHealth();

  return (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="text-sm text-muted">System health</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className={chip(h.supabaseOk)}>Supabase {h.supabaseOk ? "OK" : "FEIL"}</span>
      </div>

      {!h.supabaseOk && (
        <div className="mt-2 text-xs text-muted">Detalj: {h.supabaseError}</div>
      )}

      <div className="mt-4 text-sm font-semibold">Cron</div>
      <div className="mt-2 space-y-2 text-sm">
        {(["forecast", "preprod", "week-visibility"] as const).map((job) => {
          const r = (h.cron as any)[job];
          const ok = r?.status === "ok";
          return (
            <div key={job} className="flex items-center justify-between rounded-xl border bg-white p-3">
              <div className="font-medium">{job}</div>
              <div className="flex items-center gap-2">
                <span className={ok ? "lp-chip lp-chip-ok" : "lp-chip lp-chip-warn"}>
                  {r ? r.status : "ukjent"}
                </span>
                <span className="text-xs text-muted">{r?.ran_at ?? "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
