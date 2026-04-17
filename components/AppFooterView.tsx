"use client";

import Image from "next/image";
import Link from "next/link";

import type { AppFooterViewModel } from "@/lib/layout/globalFooterFromCms";

type AppFooterViewProps = AppFooterViewModel & {
  innerMaxClassName: string;
  footerClassName: string;
};

/** Presentational twin of `AppFooter` — same DOM/CSS, props from server or client fetch. */
export default function AppFooterView({ innerMaxClassName, footerClassName, links, columns, bottomText }: AppFooterViewProps) {
  const hasLinks = links.length > 0;
  const hasColumns = columns.length > 0;

  return (
    <footer className={footerClassName} aria-label="Footer">
      <div className={innerMaxClassName}>
        <div className="lp-footer-grid">
          <div className="lp-footer-col lp-footer-brandcol">
            <Link href="/" className="lp-footer-brand" aria-label="Gå til forsiden">
              <Image
                src="/brand/LP-logo-uten-bakgrunn.png"
                alt="Lunchportalen"
                width={900}
                height={320}
                className="lp-footer-logo"
                priority={false}
              />
            </Link>
          </div>

          {hasColumns
            ? columns.map((col, ci) => (
                <div key={`col-${ci}-${col.head}`} className="lp-footer-col">
                  {col.head ? <div className="lp-footer-head">{col.head}</div> : null}
                  <div className="lp-footer-links">
                    {col.links.map((item, li) => (
                      <Link key={`${ci}-${li}-${item.href}`} className="lp-footer-link" href={item.href}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            : null}
        </div>

        {hasLinks ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[rgb(var(--lp-border))] pt-4">
            {links.map((item, i) => (
              <Link key={`${i}-${item.href}`} className="lp-footer-link" href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        {bottomText ? (
          <div className="lp-footer-bottom mt-4">
            <span>{bottomText}</span>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
