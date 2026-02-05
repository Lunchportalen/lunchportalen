"use client";

import { useEffect, useState } from "react";

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    ok: true;
    rid: string;
    stats: { total: number; active: number; used: number; expired: number };
  };
};
type ApiErr = { ok: false; rid?: string; error: string; message?: string };

export default function PendingInvitesStat() {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/employees/invites/stats", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;
        if (!alive) return;
        if (!res.ok || !json || (json as any).ok !== true) return;
        const stats = (json as ApiOk).data?.stats;
        setActive(typeof stats?.active === "number" ? stats.active : null);
      } catch {
        if (!alive) return;
        setActive(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="text-xs text-neutral-600">
      Pending invites: <span className="font-semibold">{active === null ? "—" : active}</span>
    </div>
  );
}

