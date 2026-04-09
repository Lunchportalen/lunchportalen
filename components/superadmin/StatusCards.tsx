// STATUS: KEEP

import { osloTodayISODate } from "@/lib/date/oslo";
import { getSuperadminCounts } from "@/lib/superadmin/queries";

export default async function StatusCards() {
  const todayISO = osloTodayISODate();
  const c = await getSuperadminCounts(todayISO);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-2xl border bg-surface p-4">
        <div className="text-sm text-muted">Aktive firma</div>
        <div className="mt-1 text-2xl font-semibold">{c.activeCompanies}</div>
      </div>
      <div className="rounded-2xl border bg-surface p-4">
        <div className="text-sm text-muted">På pause</div>
        <div className="mt-1 text-2xl font-semibold">{c.pausedCompanies}</div>
      </div>
      <div className="rounded-2xl border bg-surface p-4">
        <div className="text-sm text-muted">Stengt</div>
        <div className="mt-1 text-2xl font-semibold">{c.closedCompanies}</div>
      </div>
      <div className="rounded-2xl border bg-surface p-4">
        <div className="text-sm text-muted">Dagens leveranser</div>
        <div className="mt-1 text-2xl font-semibold">{c.deliveriesToday}</div>
        <div className="mt-1 text-xs text-muted">{c.portionsToday} porsjoner</div>
      </div>
    </div>
  );
}
