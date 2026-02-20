"use client";

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

function HamburgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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
          <HamburgerIcon />
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
