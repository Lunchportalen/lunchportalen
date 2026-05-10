"use client";

import { useEffect, useState } from "react";

type Deviations = {
  unpacked: number;
  undelivered: number;
};

export default function SuperadminDeviationIndicator() {
  const [data, setData] = useState<Deviations | null>(null);

  async function load() {
    const res = await fetch("/api/superadmin/deviations", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    setData({
      unpacked: Number(json?.data?.unpacked ?? 0),
      undelivered: Number(json?.data?.undelivered ?? 0),
    });
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!data || (data.unpacked <= 0 && data.undelivered <= 0)) return null;

  return (
    <div className="mt-4 rounded-[1.25rem] bg-red-50 px-4 py-3 text-sm font-semibold text-red-950 ring-1 ring-red-200" role="alert">
      {data.unpacked > 0 ? <div>{data.unpacked} leveranser ikke pakket</div> : null}
      {data.undelivered > 0 ? <div>{data.undelivered} leveranser ikke levert</div> : null}
    </div>
  );
}
