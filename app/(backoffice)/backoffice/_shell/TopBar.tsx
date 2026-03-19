"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SemanticIconKey } from "@/lib/iconRegistry";
import { Icon } from "@/components/ui/Icon";

const TABS: { label: string; href: string; iconName: SemanticIconKey }[] = [
  { label: "Content", href: "/backoffice/content", iconName: "content" },
  { label: "Releases", href: "/backoffice/releases", iconName: "releases" },
  { label: "Media", href: "/backoffice/media", iconName: "media" },
  { label: "Templates", href: "/backoffice/templates", iconName: "template" },
  { label: "Users", href: "/backoffice/users", iconName: "users" },
  { label: "Members", href: "/backoffice/members", iconName: "employee" },
  { label: "Forms", href: "/backoffice/forms", iconName: "form" },
  { label: "Translation", href: "/backoffice/translation", iconName: "translation" },
  { label: "Settings", href: "/backoffice/settings", iconName: "settings" },
];

export default function TopBar() {
  const pathname = usePathname() ?? "";

  return (
    <header
      className="lp-motion-card flex h-12 shrink-0 items-center border-b border-white/10 bg-slate-900/85 px-4 backdrop-blur-md"
    >
      <nav className="flex items-center gap-6" aria-label="Backoffice-moduler">
        {TABS.map((tab) => {
          const isContent = tab.href === "/backoffice/content";
          const isReleases = tab.href === "/backoffice/releases";
          const isActive =
            pathname === tab.href ||
            (isContent && (pathname === "/backoffice/content" || pathname.startsWith("/backoffice/content/"))) ||
            (isReleases && pathname.startsWith("/backoffice/releases"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`lp-motion-btn relative flex items-center gap-2 py-3 text-sm font-medium text-white/90 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${isActive ? "text-white" : ""}`}
            >
              <Icon name={tab.iconName} size="sm" />
              <span>{tab.label}</span>
              {isActive ? (
                <span
                  className="lp-motion-btn absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"
                  style={{ height: "3px" }}
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
