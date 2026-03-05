// src/components/nav/HeaderShell.tsx
import "server-only";

import Link from "next/link";
import Image from "next/image";

import LogoutClient from "@/components/auth/LogoutClient";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type TabConfig = { label: string; href: string; exact?: boolean };

type HeaderConfig = {
  areaLabel: string;
  title: string;
  tabs: TabConfig[];
};

async function resolveHeaderConfig(): Promise<{ role: Role | "public"; email: string | null; config: HeaderConfig }> {
  let role: Role | "public" = "public";
  let email: string | null = null;

  try {
    const { getScopeServer } = await import("@/lib/auth/getScopeServer");
    const { scope, user } = await getScopeServer();
    role = (scope.role as Role) ?? "employee";
    email = (scope.email as string | null) ?? (user?.email ?? null);
  } catch {
    role = "public";
    email = null;
  }

  const configs: Record<Role | "public", HeaderConfig> = {
    public: {
      areaLabel: "Offentlig header",
      title: "Lunchportalen",
      tabs: [
        { label: "Hjem", href: "/" },
        { label: "Ukeplan", href: "/week" },
      ],
    },
    employee: {
      areaLabel: "Ansattportal",
      title: "Min lunsjordning",
      tabs: [
        { label: "Ukeplan", href: "/week", exact: true },
        { label: "Mine bestillinger", href: "/orders" },
      ],
    },
    company_admin: {
      areaLabel: "Adminportal",
      title: "Admin",
      tabs: [
        { label: "Dashboard", href: "/admin", exact: true },
        { label: "Firma", href: "/admin/companies" },
        { label: "Avtale", href: "/admin/agreement" },
        { label: "Locations", href: "/admin/locations" },
        { label: "Ansatte", href: "/admin/employees" },
        { label: "Meny", href: "/admin/menus" },
        { label: "Innsikt", href: "/admin/insights" },
        { label: "Historikk", href: "/admin/history" },
        { label: "ESG", href: "/admin/baerekraft" },
      ],
    },
    superadmin: {
      areaLabel: "Superadminportal",
      title: "Superadmin",
      tabs: [
        { label: "Oversikt", href: "/superadmin", exact: true },
        { label: "CFO", href: "/superadmin/cfo" },
        { label: "Konsern", href: "/superadmin/enterprise" },
        { label: "Firma", href: "/superadmin/companies" },
        { label: "ESG", href: "/superadmin/esg" },
        { label: "System", href: "/superadmin/system" },
        { label: "Audit", href: "/superadmin/audit" },
      ],
    },
    kitchen: {
      areaLabel: "Kjøkkenportal",
      title: "Kjøkken",
      tabs: [
        { label: "Produksjon i dag", href: "/kitchen" },
        { label: "Rapporter", href: "/kitchen/report" },
      ],
    },
    driver: {
      areaLabel: "Sjåførportal",
      title: "Sjåfør",
      tabs: [{ label: "Ruter i dag", href: "/driver" }],
    },
  };

  const config = configs[role] ?? configs.public;
  return { role, email, config };
}

export default async function HeaderShell() {
  const { email, config } = await resolveHeaderConfig();

  return (
    <header className="border-b border-[rgb(var(--lp-border))] bg-white">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 md:py-4">
        {/* Left: logo */}
        <div className="flex items-center justify-self-start">
          <Link href="/" className="flex items-center gap-3" aria-label={config.areaLabel}>
            <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-900 md:h-10 md:w-10">
              <Image
                src="/brand/LP-logo-uten-bakgrunn.png"
                alt="Lunchportalen"
                width={120}
                height={120}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <span className="hidden text-sm font-semibold text-[rgb(var(--lp-text))] md:inline">{config.title}</span>
          </Link>
        </div>

        {/* Center: tabs */}
        <nav className="hidden justify-self-center md:block" aria-label={config.areaLabel}>
          <ul className="inline-flex items-center gap-4 text-sm">
            {config.tabs.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className="rounded-full px-3 py-1 text-sm text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right: email + logout */}
        <div className="flex items-center justify-end gap-3 justify-self-end">
          {email ? (
            <div className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1 text-xs text-[rgb(var(--lp-muted))]">
              {email}
            </div>
          ) : null}
          <LogoutClient />
        </div>
      </div>
    </header>
  );
}

