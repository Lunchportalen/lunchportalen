"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ProfileMenu } from "@/components/nav/ProfileMenu";
import type { HeaderShellViewModel } from "@/lib/layout/globalHeaderFromCms";

/** Production logo in public/ root (logo-pack SVG is a design template, not final artwork). */
const HEADER_LOGO_PUBLIC_PNG = "/Logo LunchPortalen uten bakgrunn.png";

type HeaderShellViewProps = HeaderShellViewModel & {
  headerClassName: string;
  innerGridClassName: string;
  email: string | null;
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
}: HeaderShellViewProps) {
  const [headerLogoSrc, setHeaderLogoSrc] = useState(HEADER_LOGO_PUBLIC_PNG);

  return (
    <header className={headerClassName}>
      <div className={innerGridClassName}>
        <div className="flex items-center justify-self-start min-w-0">
          <Link href="/" className="flex min-w-0 items-center" aria-label={areaLabel}>
            <Image
              src={headerLogoSrc}
              alt="Lunchportalen"
              width={180}
              height={32}
              className="h-6 w-auto object-contain object-left md:h-8"
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

        <div className="flex items-center justify-end gap-3 justify-self-end min-w-0">
          {email ? (
            <span
              className="hidden max-w-[min(280px,28vw)] truncate text-sm text-[rgb(var(--lp-muted))] md:inline"
              title={email}
            >
              {email}
            </span>
          ) : null}
          <ProfileMenu email={email} />
        </div>
      </div>
    </header>
  );
}
