"use client";

import { Icon } from "@/components/ui/Icon";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Item = { label: string; href: string };

const items: Item[] = [
  { label: "Dashboard", href: "/superadmin" },
  { label: "CFO", href: "/superadmin/cfo" },
  { label: "Konsern", href: "/superadmin/enterprise" },
  { label: "Firma", href: "/superadmin/companies" },
  { label: "ESG", href: "/superadmin/esg" },
  { label: "Audit", href: "/superadmin/audit" },
  { label: "System", href: "/superadmin/system" },
];

export function SuperadminMobileMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={"relative " + className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border px-3 py-1 text-sm opacity-90 hover:opacity-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Åpne meny"
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="menu" size="md" />
          <span className="hidden xs:inline">Meny</span>
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border bg-white shadow"
          role="menu"
          aria-label="Superadmin meny"
        >
          <div className="p-1">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="block rounded-lg px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
