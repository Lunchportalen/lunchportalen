"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { label: string; href: string }[] = [
  { label: "Content", href: "/backoffice/content" },
  { label: "Releases", href: "/backoffice/releases" },
  { label: "Media", href: "/backoffice/media" },
  { label: "Templates", href: "/backoffice/templates" },
  { label: "Users", href: "/backoffice/users" },
  { label: "Members", href: "/backoffice/members" },
  { label: "Forms", href: "/backoffice/forms" },
  { label: "Translation", href: "/backoffice/translation" },
  { label: "Settings", href: "/backoffice/settings" },
];

export default function TopBar() {
  const pathname = usePathname() ?? "";

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[rgb(var(--lp-border))] bg-slate-900 px-4">
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
              className={`relative py-3 text-sm font-medium text-white/90 transition hover:text-white ${
                isActive ? "text-white" : ""
              }`}
            >
              {tab.label}
              {isActive ? (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"
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
