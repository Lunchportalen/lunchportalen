// components/PublicHeader.tsx
import Image from "next/image";
import Link from "next/link";

type NavItem = { label: string; href: string };

export default function PublicHeader({
  areaLabel,
  nav,
}: {
  areaLabel: string;
  nav: NavItem[];
}) {
  return (
    <header className="lp-topbar">
      <div className="lp-container lp-topbar-inner">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Gå til forsiden" className="inline-flex items-center focus:outline-none">
            <Image
              src="/brand/LP-logo-uten-bakgrunn.png"
              alt="Lunchportalen"
              width={240}
              height={120}
              sizes="(max-width: 640px) 160px, 240px"
              className="h-14 md:h-[100px] w-auto max-h-[100px] object-contain"
              priority
            />
          </Link>

          <span className="hidden md:inline-block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            {areaLabel}
          </span>
        </div>

        <nav className="lp-topbar-nav hidden md:flex items-center gap-2 text-sm" aria-label="Hovedmeny">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="lp-nav-item">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="lp-topbar-slot">
          <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))]">
            Ikke innlogget
          </span>
          <Link href="/login" className="lp-btn lp-btn--ghost lp-btn--sm">
            Til login
          </Link>
        </div>
      </div>

      {nav.length > 0 ? (
        <div className="md:hidden border-t border-[rgb(var(--lp-border))] bg-white/80 backdrop-blur">
          <div className="lp-container py-2 flex gap-2 overflow-x-auto">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="lp-nav-item whitespace-nowrap">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
