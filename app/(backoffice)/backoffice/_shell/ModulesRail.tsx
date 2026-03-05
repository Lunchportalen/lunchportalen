"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconContent,
  IconMedia,
  IconTemplate,
  IconUsers,
  IconMember,
  IconForm,
  IconTranslation,
  IconSettings,
} from "./icons";

const MODULES: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { href: "/backoffice/content", icon: IconContent, label: "Content" },
  { href: "/backoffice/media", icon: IconMedia, label: "Media" },
  { href: "/backoffice/templates", icon: IconTemplate, label: "Templates" },
  { href: "/backoffice/users", icon: IconUsers, label: "Users" },
  { href: "/backoffice/members", icon: IconMember, label: "Members" },
  { href: "/backoffice/forms", icon: IconForm, label: "Forms" },
  { href: "/backoffice/translation", icon: IconTranslation, label: "Translation" },
  { href: "/backoffice/settings", icon: IconSettings, label: "Settings" },
];

export default function ModulesRail() {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className="flex w-16 shrink-0 flex-col items-center border-r border-[rgb(var(--lp-border))] bg-slate-800 py-2"
      style={{ width: "64px" }}
      aria-label="Moduler"
    >
      {MODULES.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || (href !== "/backoffice/content" && pathname.startsWith(href + "/")) || (href === "/backoffice/content" && pathname.startsWith("/backoffice/content"));
        return (
          <Link
            key={href}
            href={href}
            className="flex h-10 w-10 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
            title={label}
            aria-current={isActive ? "true" : undefined}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}
    </aside>
  );
}
