"use client";

import { Suspense, useState } from "react";

import CompanyRegistrationForm from "@/components/auth/CompanyRegistrationForm";
import { RegistrationDemoFunnelBeacon } from "@/components/registration/RegistrationDemoFunnelBeacon";
import RoleGate from "@/components/registration/RoleGate";

export default function PublicRegistrationFlow() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <>
        <Suspense fallback={null}>
          <RegistrationDemoFunnelBeacon />
        </Suspense>
        <RoleGate onSelectCompanyAdmin={() => setStarted(true)} companyAdminDisabled={false} />
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <RegistrationDemoFunnelBeacon />
      </Suspense>
      <div className="w-full max-w-none px-0 py-0">
        <CompanyRegistrationForm />
      </div>
    </>
  );
}
