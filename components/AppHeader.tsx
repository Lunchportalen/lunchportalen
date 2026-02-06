// components/AppHeader.tsx
import Image from "next/image";
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
        <div className="flex min-w-0 items-center gap-3">
          <div className="lp-brand min-w-0">
            <Link href="/" aria-label="G� til forsiden" className="inline-flex items-center bg-transparent border-0 ring-0 outline-none focus-visible:ring-0 focus-visible:outline-none">
              <Image
                src="/brand/LP-logo-uten-bakgrunn.png"
                alt="Lunchportalen"
                width={240}
                height={120}
                sizes="(max-width: 640px) 160px, 240px"
                className="h-16 md:h-[120px] w-auto max-h-[120px] object-contain"
                priority
              />
            </Link>
          </div>
        </div>

        <nav className="lp-topbar-nav hidden md:flex items-center gap-4 text-sm text-[rgb(var(--lp-muted))]">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[rgb(var(--lp-text))]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="lp-topbar-slot">
          {email ? (
            <span className="lp-pill-email rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))] lp-wrap-anywhere">
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
