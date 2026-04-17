"use client";

import type { ReactNode } from "react";

import AppFooterView from "@/components/AppFooterView";
import HeaderShellView from "@/components/nav/HeaderShellView";
import { useSiteChrome } from "@/components/layout/useSiteChrome";

/** Client twin of `app/(public)/layout.tsx` chrome (no analytics / variant scripts — preview-safe). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  const { email, headerModel, footerModel, headerClassName, innerGridClassName, footerClassName, innerFooterMax } =
    useSiteChrome("marketing");

  return (
    <div className="lp-page">
      <HeaderShellView
        {...headerModel}
        email={email}
        headerClassName={headerClassName}
        innerGridClassName={innerGridClassName}
      />
      <main className="lp-main">
        <div className="w-full">{children}</div>
      </main>
      <AppFooterView {...footerModel} footerClassName={footerClassName} innerMaxClassName={innerFooterMax} />
    </div>
  );
}
