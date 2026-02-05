"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ActionMenuItem =
  | { kind: "link"; label: string; href: string; disabled?: boolean; note?: string }
  | { kind: "action"; label: string; onClick: () => void; disabled?: boolean; note?: string };

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export default function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onClick(e: MouseEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }

    if (open) {
      window.addEventListener("keydown", onKey);
      window.addEventListener("mousedown", onClick, true);
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const top = Math.round(rect.bottom + 8);
    const right = Math.max(12, Math.round(window.innerWidth - rect.right));
    setPos({ top, right });

    function onReflow() {
      const r = btn.getBoundingClientRect();
      const nextTop = Math.round(r.bottom + 8);
      const nextRight = Math.max(12, Math.round(window.innerWidth - r.right));
      setPos({ top: nextTop, right: nextRight });
    }

    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  // Portal required to avoid clipping by container overflow.
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "bg-white text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] transition",
          "hover:bg-black/5"
        )}
      >
        ⋯
      </button>

      {open && pos
        ? createPortal(
            <div
              role="menu"
              style={{ top: `${pos.top}px`, right: `${pos.right}px` }}
              className="fixed z-[1000] w-48 rounded-xl bg-white shadow-lg ring-1 ring-[rgb(var(--lp-border))]"
            >
          {items.map((item, idx) => {
            const key = item.kind === "link" ? item.href : `${item.label}-${idx}`;
            const note = item.note ? <span className="ml-2 text-xs font-normal text-neutral-400">({item.note})</span> : null;

            if (item.kind === "link") {
              if (item.disabled) {
                return (
                  <button
                    key={key}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm font-semibold text-neutral-400"
                    aria-disabled="true"
                    disabled
                  >
                    {item.label}
                    {note}
                  </button>
                );
              }

              return (
                <Link
                  key={key}
                  href={item.href}
                  className="block px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={key}
                type="button"
                className={cx(
                  "block w-full px-4 py-2 text-left text-sm font-semibold",
                  item.disabled ? "text-neutral-400" : "text-neutral-800 hover:bg-neutral-50"
                )}
                aria-disabled={item.disabled ? "true" : "false"}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.label}
                {note}
              </button>
            );
          })}
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
