"use client";

import { useState } from "react";

import CompanyRegistrationForm from "@/components/auth/CompanyRegistrationForm";
import RoleGate from "@/components/registration/RoleGate";
import { Container } from "@/components/ui/container";

export default function PublicRegistrationFlow() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <RoleGate onSelectCompanyAdmin={() => setStarted(true)} companyAdminDisabled={false} />;
  }

  return (
    <Container className="max-w-3xl py-6">
      <CompanyRegistrationForm />
    </Container>
  );
}
