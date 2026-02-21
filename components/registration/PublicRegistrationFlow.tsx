"use client";

import { useState } from "react";

import CompanyRegistrationForm from "@/components/auth/CompanyRegistrationForm";
import RoleGate from "@/components/registration/RoleGate";

export default function PublicRegistrationFlow() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <RoleGate onSelectCompanyAdmin={() => setStarted(true)} companyAdminDisabled={false} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <CompanyRegistrationForm />
    </div>
  );
}
