import type { Metadata } from "next";
import type { ReactNode } from "react";

const ogTitle = "Se Forretningsscore før og etter — AI-demo";
const ogDescription =
  "20 sekunder som viser forskjellen: manuelt fragmentert vs. målt AI-styring av margin og strategi. Interaktiv demo for superadmin.";

export const metadata: Metadata = {
  title: ogTitle,
  description: ogDescription,
  robots: { index: false, follow: false },
  openGraph: {
    title: ogTitle,
    description: ogDescription,
    type: "website",
    locale: "nb_NO",
    siteName: "Lunchportalen",
    url: "/backoffice/ai/overview",
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDescription,
  },
};

export default function AiOverviewLayout({ children }: { children: ReactNode }) {
  return children;
}
