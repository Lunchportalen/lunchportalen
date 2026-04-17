"use client";

import { Suspense, useState } from "react";

import CompanyRegistrationForm from "@/components/auth/CompanyRegistrationForm";
import { RegistrationDemoFunnelBeacon } from "@/components/registration/RegistrationDemoFunnelBeacon";
import RoleGate from "@/components/registration/RoleGate";
import { Container } from "@/components/ui/container";

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
      <Container className="max-w-3xl py-6">
        <CompanyRegistrationForm />
      </Container>
    </>
  );
}
