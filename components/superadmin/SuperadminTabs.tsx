"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/superadmin" },
  { label: "CFO", href: "/superadmin/cfo" },
  { label: "Konsern", href: "/superadmin/enterprise" },
  { label: "Firma", href: "/superadmin/companies" },
  { label: "ESG", href: "/superadmin/esg" },
  { label: "Audit", href: "/superadmin/audit" },
  { label: "System", href: "/superadmin/system" },
];

export function SuperadminTabs({ className = "" }: { className?: string }) {
  const pathname = usePathname() || "";
  return (
    <nav className={"inline-flex items-center gap-3 text-sm " + className} aria-label="Superadmin">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              active
                ? "rounded-full border bg-white px-3 py-1 text-sm"
                : "px-2 py-1 opacity-80 hover:opacity-100"
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
