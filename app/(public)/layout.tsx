import type { ReactNode } from "react";

import AppFooter from "@/components/AppFooter";
import PublicHeader from "@/components/site/PublicHeader";

type NavItem = { label: string; href: string };

const PUBLIC_NAV: NavItem[] = [
  { label: "Forside", href: "/" },
  { label: "Hvordan", href: "/hvordan" },
  { label: "Lunsjordning", href: "/lunsjordning" },
  { label: "Alternativ til kantine", href: "/alternativ-til-kantine" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp-page">
      <PublicHeader nav={PUBLIC_NAV} />

      <main className="lp-main">
        <div className="w-full">{children}</div>
      </main>

      <AppFooter containerMode="full" />
    </div>
  );
}
