"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ProfileMenu } from "@/components/nav/ProfileMenu";
import LocaleSwitcher from "@/components/nav/LocaleSwitcher";
import type { HeaderShellViewModel } from "@/lib/layout/globalHeaderFromCms";

/** Production logo in public/ root (logo-pack SVG is a design template, not final artwork). */
const HEADER_LOGO_PUBLIC_PNG = "/Logo LunchPortalen uten bakgrunn.png";

/** Preserves max-width from server/marketing `innerGridClassName` while fixing mobile alignment (flex vs grid). */
function headerInnerShellClassName(innerGridClassName: string): string {
  const max = innerGridClassName.includes("max-w-none")
    ? "max-w-none"
    : innerGridClassName.includes("max-w-[1600px]")
      ? "max-w-[1600px]"
      : "max-w-[1440px]";
  return [
    "mx-auto",
    "flex",
    "w-full",
    max,
    "items-center",
    "justify-between",
    "px-4",
    "py-3",
    "md:py-4",
    "md:grid",
    "md:grid-cols-[1fr_auto_1fr]",
    "md:justify-normal",
  ].join(" ");
}

type HeaderShellViewProps = HeaderShellViewModel & {
  headerClassName: string;
  innerGridClassName: string;
  email: string | null;
  /** When false, hide UI locale switcher (employee shell until employee i18n ships). */
  showLocaleSwitcher?: boolean;
};

/** Presentational twin of `HeaderShell` — same DOM/CSS, props from server or client fetch. */
export default function HeaderShellView({
  headerClassName,
  innerGridClassName,
  title: _title,
  areaLabel,
  logoSrc,
  navigation,
  email,
  showLocaleSwitcher = true,
}: HeaderShellViewProps) {
  const [headerLogoSrc, setHeaderLogoSrc] = useState(HEADER_LOGO_PUBLIC_PNG);

  return (
    <header className={headerClassName}>
      <div className={headerInnerShellClassName(innerGridClassName)}>
        <div className="flex min-w-0 items-center md:justify-self-start">
          <Link href="/" className="flex min-w-0 items-center md:justify-self-start" aria-label={areaLabel}>
            <Image
              src={headerLogoSrc}
              alt="Lunchportalen"
              width={180}
              height={32}
              className="h-auto w-32 md:w-40"
              priority
              onError={() => setHeaderLogoSrc(logoSrc)}
            />
          </Link>
        </div>

        <nav className="hidden justify-self-center md:block" aria-label={areaLabel}>
          <ul className="inline-flex items-center gap-4 text-sm">
            {navigation.map((item, i) => (
              <li key={`${i}-${item.href}`}>
                <Link
                  href={item.href}
                  className="rounded-full px-3 py-1 text-sm text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 items-center gap-3 md:justify-self-end">
          {email ? (
            <span
              className="hidden max-w-[min(280px,28vw)] truncate text-sm text-[rgb(var(--lp-muted))] md:inline"
              title={email}
            >
              {email}
            </span>
          ) : null}
          {showLocaleSwitcher ? <LocaleSwitcher persistProfile={Boolean(email)} /> : null}
          <ProfileMenu email={email} />
        </div>
      </div>
    </header>
  );
}
