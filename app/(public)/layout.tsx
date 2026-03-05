import type { ReactNode } from "react";

import AppFooter from "@/components/AppFooter";
import PublicHeader from "@/components/site/PublicHeader";
import { TrackPageView } from "@/lib/public/analytics/TrackPageView";
import { CtaClickTracker } from "@/lib/public/analytics/CtaClickTracker";

type NavItem = { label: string; href: string };

const PUBLIC_NAV: NavItem[] = [
  { label: "Forside", href: "/" },
  { label: "Hvordan", href: "/hvordan" },
  { label: "Lunsjordning", href: "/lunsjordning" },
  { label: "Alternativ til kantine", href: "/alternativ-til-kantine" },
];

const PUBLIC_ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp-page">
      <TrackPageView environment={PUBLIC_ENV} locale="nb" pageId={null} variantId={null} />
      <CtaClickTracker />
      <PublicHeader nav={PUBLIC_NAV} />

      <main className="lp-main">
        <div className="w-full">{children}</div>
      </main>

      <AppFooter containerMode="full" />
    </div>
  );
}
