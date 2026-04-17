"use client";

import DataTrustBadge, { type DataTrustKind } from "@/components/superadmin/DataTrustBadge";

import { LiveStatusDot } from "./LiveStatusDot";

export function LiveSectionHeading({ title, trustKind }: { title: string; trustKind: DataTrustKind }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">{title}</h2>
      <LiveStatusDot kind={trustKind} />
      <DataTrustBadge kind={trustKind} />
    </div>
  );
}
