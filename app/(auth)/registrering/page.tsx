import type { Metadata } from "next";
import Script from "next/script";
import RegistrationGate from "@/components/auth/RegistrationGate";

export const metadata: Metadata = {
  title: "Registrer firma – Lunchportalen",
  description:
    "Kun firma-admin kan registrere ny bedrift. Ansatte skal bruke innlogging.",
  alternates: {
    canonical: "/registrering",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Registrer firma – Lunchportalen",
    description:
      "Registrer bedrift for firmalunsj. Kun firma-admin kan opprette ny avtale.",
    url: "/registrering",
    siteName: "Lunchportalen",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Registrer firma – Lunchportalen",
    description:
      "Kun firma-admin kan registrere ny bedrift. Ansatte skal bruke innlogging.",
  },
};

export default function Page() {
  return (
    <>
      {/* Strukturert data for SEO og entydig sideforståelse */}
      <Script
        id="registration-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Registrer firma – Lunchportalen",
            url: "https://lunchportalen.no/registrering",
            description:
              "Registrering for firma-admin. Ansatte skal bruke innlogging.",
            isPartOf: {
              "@type": "WebSite",
              name: "Lunchportalen",
              url: "https://lunchportalen.no",
            },
          }),
        }}
      />

      <RegistrationGate />
    </>
  );
}
