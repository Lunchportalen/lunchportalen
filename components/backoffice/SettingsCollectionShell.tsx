"use client";

import Link from "next/link";

export type SettingsCollectionNavItem = {
  href: string;
  label: string;
  description?: string;
  active?: boolean;
};

export function SettingsCollectionShell({
  title,
  description,
  navItems,
  children,
}: {
  title: string;
  description?: string;
  navItems: readonly SettingsCollectionNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-zinc-950">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-zinc-600">{description}</p>
          ) : null}
        </div>

        <nav className="space-y-1" aria-label="CMS-innstillinger">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-lg px-3 py-3 transition",
                item.active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-100",
              ].join(" ")}
            >
              <div className="text-sm font-medium">{item.label}</div>
              {item.description ? (
                <div
                  className={[
                    "mt-0.5 text-xs",
                    item.active ? "text-white/75" : "text-zinc-500",
                  ].join(" ")}
                >
                  {item.description}
                </div>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="min-w-0">{children}</section>
    </div>
  );
}