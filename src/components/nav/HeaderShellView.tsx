"use client";

import Link from "next/link";
import Image from "next/image";

import LogoutClient from "@/components/auth/LogoutClient";
import type { HeaderShellViewModel } from "@/lib/layout/globalHeaderFromCms";

type HeaderShellViewProps = HeaderShellViewModel & {
  headerClassName: string;
  innerGridClassName: string;
  email: string | null;
};

/** Presentational twin of `HeaderShell` — same DOM/CSS, props from server or client fetch. */
export default function HeaderShellView({
  headerClassName,
  innerGridClassName,
  title,
  areaLabel,
  logoSrc,
  navigation,
  email,
}: HeaderShellViewProps) {
  return (
    <header className={headerClassName}>
      <div className={innerGridClassName}>
        <div className="flex items-center justify-self-start">
          <Link href="/" className="flex items-center gap-3" aria-label={areaLabel}>
            <div className="h-8 w-8 overflow-clip rounded-full bg-slate-900 md:h-10 md:w-10">
              <Image
                src={logoSrc}
                alt="Lunchportalen"
                width={120}
                height={120}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <span className="hidden text-sm font-semibold text-[rgb(var(--lp-text))] md:inline">{title}</span>
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
