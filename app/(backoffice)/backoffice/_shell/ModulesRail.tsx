"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type SemanticIconKey } from "./icons";

const MODULES: { href: string; icon: SemanticIconKey; label: string }[] = [
  { href: "/backoffice/content", icon: "content", label: "Content" },
  { href: "/backoffice/media", icon: "media", label: "Media" },
  { href: "/backoffice/templates", icon: "template", label: "Templates" },
  { href: "/backoffice/users", icon: "users", label: "Users" },
  { href: "/backoffice/members", icon: "employee", label: "Members" },
  { href: "/backoffice/forms", icon: "form", label: "Forms" },
  { href: "/backoffice/translation", icon: "translation", label: "Translation" },
  { href: "/backoffice/settings", icon: "settings", label: "Settings" },
];

export default function ModulesRail() {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="flex w-16 shrink-0 flex-col items-center border-r border-[rgb(var(--lp-border))] bg-slate-800 py-2"
      style={{ width: "64px" }}
      aria-label="Moduler"
    >
      {MODULES.map(({ href, icon, label }) => {
        const isActive = pathname === href || (href !== "/backoffice/content" && pathname.startsWith(href + "/")) || (href === "/backoffice/content" && pathname.startsWith("/backoffice/content"));
        return (
          <Link
            key={href}
            href={href}
            className="flex h-10 w-10 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
            title={label}
            aria-current={isActive ? "true" : undefined}
          >
            <Icon name={icon} className="h-5 w-5" />
          </Link>
        );
      })}
    </aside>
  );
}
