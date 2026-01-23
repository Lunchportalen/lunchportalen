// app/admin/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function tabClass(active: boolean) {
  return [
    "inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium ring-1 transition",
    active
      ? "bg-black text-white ring-black"
      : "bg-white text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-surface))]",
  ].join(" ");
}

export default function AdminNav() {
  const pathname = usePathname();

  const items = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/users", label: "Ansatte" },
    { href: "/admin/orders", label: "Ordrer" }, // (valgfritt å lage senere)
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((i) => {
        const active = pathname === i.href || pathname.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} className={tabClass(active)}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
