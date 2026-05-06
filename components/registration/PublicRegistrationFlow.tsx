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
      <Container className="!max-w-[1600px] !px-2 py-3 sm:!px-3 sm:py-4 lg:!px-4 lg:py-5 2xl:!px-5">
        <CompanyRegistrationForm />
      </Container>
    </>
  );
}
