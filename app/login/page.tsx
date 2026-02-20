import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Logg inn - Lunchportalen",
  description: "Sikker innlogging for ansatte og administratorer i Lunchportalen.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Logg inn"
      subtitle="Bruk e-post og passord for å åpne riktig arbeidsflate."
      footer={
        <Link href="/forgot-password" className="underline underline-offset-4">
          Glemt passord?
        </Link>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
