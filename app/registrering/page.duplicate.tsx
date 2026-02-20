import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import RegistrationGate from "@/components/auth/RegistrationGate";

export const metadata: Metadata = {
  title: "Registrer firma - Lunchportalen",
  description:
    "Registrer firma for onboarding. Firma-admin registrerer. Ansatte skal logge inn via innlogging.",
  alternates: { canonical: "/registrering" },
  robots: { index: true, follow: true },
};

export default function Page() {
  const registrationsEnabled = String(process.env.REGISTRATIONS_ENABLED ?? "").toLowerCase() === "true";
  const blockedReason = registrationsEnabled
    ? null
    : "Registrering er midlertidig utilgjengelig. Kontakt support for manuell aktivering.";

  return (
    <AuthShell
      title="Registrer firma"
      subtitle="Registrering er kun for firma-admin. Ansatte skal logge inn med eksisterende konto."
    >
      <RegistrationGate blocked={!registrationsEnabled} blockedReason={blockedReason} />
    </AuthShell>
  );
}
