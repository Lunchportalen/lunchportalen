"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/superadmin") return pathname === "/superadmin";
  return pathname === href || pathname.startsWith(href + "/");
}

function pill(active: boolean) {
  return [
    "inline-flex items-center rounded-full px-3 py-1.5 text-sm ring-1 transition",
    active
      ? "bg-black text-white ring-black"
      : "bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))] hover:bg-white",
  ].join(" ");
}

export default function SuperadminTopNavInline() {
  const pathname = usePathname();
  const show = pathname.startsWith("/superadmin");
  if (!show) return null;

  const items = [
    { href: "/superadmin", label: "Forside" },
    { href: "/superadmin/orders-today", label: "Dagens ordre" },
    { href: "/kitchen", label: "Kjøkken" },
    { href: "/driver", label: "Driver" },
  ];

  return (
    <div className="hidden items-center gap-2 md:flex">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={pill(isActive(pathname, it.href))}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}
