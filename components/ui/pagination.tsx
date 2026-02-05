"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export interface PaginationProps {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const p = clamp(page, 1, pages);

  const canPrev = p > 1;
  const canNext = p < pages;

  const from = total === 0 ? 0 : (p - 1) * pageSize + 1;
  const to = Math.min(total, p * pageSize);

  // window of page numbers
  const nums = React.useMemo(() => {
    const w = 5;
    const start = clamp(p - Math.floor(w / 2), 1, Math.max(1, pages - w + 1));
    const end = Math.min(pages, start + w - 1);
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }, [p, pages]);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="text-xs text-[color:var(--lp-muted)]">
        Viser <span className="font-semibold text-[color:var(--lp-fg)]">{from}</span>–{" "}
        <span className="font-semibold text-[color:var(--lp-fg)]">{to}</span> av{" "}
        <span className="font-semibold text-[color:var(--lp-fg)]">{total}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={!canPrev} onClick={() => onPageChange(p - 1)}>
          Forrige
        </Button>

        <div className="flex items-center gap-1">
          {nums[0] !== 1 ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => onPageChange(1)}>
                1
              </Button>
              <span className="px-1 text-xs text-[color:var(--lp-muted)]">…</span>
            </>
          ) : null}

          {nums.map((n) => (
            <Button
              key={n}
              variant={n === p ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(n)}
            >
              {n}
            </Button>
          ))}

          {nums[nums.length - 1] !== pages ? (
            <>
              <span className="px-1 text-xs text-[color:var(--lp-muted)]">…</span>
              <Button variant="ghost" size="sm" onClick={() => onPageChange(pages)}>
                {pages}
              </Button>
            </>
          ) : null}
        </div>

        <Button variant="secondary" size="sm" disabled={!canNext} onClick={() => onPageChange(p + 1)}>
          Neste
        </Button>
      </div>
    </div>
  );
}
