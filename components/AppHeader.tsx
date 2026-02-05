// components/AppHeader.tsx
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { getSessionUser } from "@/lib/auth/getSessionUser";

type NavItem = { label: string; href: string };

export default async function AppHeader({
  areaLabel,
  nav,
}: {
  areaLabel: string;
  nav: NavItem[];
}) {
  const session = await getSessionUser();
  const email = session?.email ?? null;

  return (
    <header className="lp-topbar">
      <div className="lp-container lp-topbar-inner">
        <div className="flex items-center gap-3">
          <div className="lp-brand">
            <span className="sr-only">Brand</span>
            <div className="lp-logo-mark" />
          </div>
          <div className="flex flex-col">
            <div className="text-[11px] font-semibold tracking-[0.26em] text-[rgb(var(--lp-muted))]">
              LUNCHPORTALEN
            </div>
            <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">{areaLabel}</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-4 text-sm text-[rgb(var(--lp-muted))]">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[rgb(var(--lp-text))]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="lp-topbar-slot">
          {email ? (
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))]">
              {email}
            </span>
          ) : (
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))]">
              Ikke innlogget
            </span>
          )}
          {email ? (
            <LogoutButton variant="ghost" />
          ) : (
            <Link href="/login" className="lp-btn lp-btn--ghost lp-btn--sm">
              Til login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
