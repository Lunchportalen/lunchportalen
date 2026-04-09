"use client";

// STATUS: KEEP

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ADMIN_DASHBOARD_HREF, ADMIN_LOGO_SRC } from "@/lib/admin/constants";

type AdminHeaderProps = {
  role: "company_admin" | "superadmin";
  userEmail?: string | null;
};

const CRUMB_LABELS: Record<string, string> = {
  "": "Command Center",
  agreement: "Avtale",
  agreements: "Avtale",
  people: "Ansatte",
  ansatte: "Ansatte",
  employees: "Ansatte",
  orders: "Ordre",
  history: "Historikk",
  locations: "Lokasjoner",
  insights: "Insights",
  dashboard: "Dashboard",
  users: "Brukere",
};

function crumbFromPath(pathname: string | null) {
  if (!pathname || !pathname.startsWith("/admin")) return "Admin";
  const parts = pathname.replace("/admin", "").split("/").filter(Boolean);
  const key = parts[0] ?? "";
  return CRUMB_LABELS[key] ?? "Admin";
}

export default function AdminHeader({ role, userEmail }: AdminHeaderProps) {
  const pathname = usePathname();
  const crumb = crumbFromPath(pathname);
  const roleLabel = role === "superadmin" ? "Superadmin" : "Firmaadmin";
  const [logoOk, setLogoOk] = useState(true);

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(var(--lp-border))] lp-glass-nav">
      <div className="lp-container py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={ADMIN_DASHBOARD_HREF}
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[rgb(var(--lp-text))]"
            >
              {logoOk ? (
                <Image
                  src={ADMIN_LOGO_SRC}
                  alt="Lunchportalen"
                  width={160}
                  height={32}
                  className="h-6 w-auto max-h-8 object-contain md:h-8"
                  onError={() => setLogoOk(false)}
                  priority
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                  LP
                </span>
              )}
            </Link>
          </div>

          <div className="hidden flex-1 justify-center text-xs text-[rgb(var(--lp-muted))] md:flex">
            <span>
              Admin / <span className="text-[rgb(var(--lp-text))]">{crumb}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[rgb(var(--lp-muted))]">
            <Link
              href={ADMIN_DASHBOARD_HREF}
              className="lp-btn lp-btn--ghost min-h-9 border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold"
            >
              Til dashbord
            </Link>
            <span className="hidden whitespace-nowrap sm:inline">Cut-off 08:00 (Europe/Oslo)</span>
            <Badge variant="outline" className="text-xs">
              {roleLabel}
            </Badge>
            {userEmail ? <span className="hidden text-xs sm:inline">{userEmail}</span> : null}
            <Link
              href="/logout"
              className="lp-btn lp-btn--ghost min-h-9 border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold"
            >
              Logg ut
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
