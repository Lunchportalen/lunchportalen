"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CompanyRegistrationForm from "@/components/auth/CompanyRegistrationForm";
import EmployeeWarningBanner from "@/components/auth/EmployeeWarningBanner";

type RegistrationGateProps = {
  blocked?: boolean;
  blockedReason?: string | null;
};

export default function RegistrationGate({ blocked = false, blockedReason = null }: RegistrationGateProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <EmployeeWarningBanner />

      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <h2 className="text-lg font-semibold">Velg rolle før du fortsetter</h2>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Kun firma-admin kan registrere ny bedrift.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="lp-btn lp-btn-primary lp-neon min-h-12"
          >
            Jeg er firma-admin (skal registrere firma)
          </button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="lp-btn lp-btn-ghost min-h-12"
          >
            Jeg er ansatt (skal logge inn)
          </button>
        </div>
      </section>

      {showForm ? (
        <div className="space-y-4">
          <EmployeeWarningBanner />
          <CompanyRegistrationForm blocked={blocked} blockedReason={blockedReason} />
        </div>
      ) : null}
    </div>
  );
}
