// app/admin/employees/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import EmployeesClient from "./employees-client";

export default function EmployeesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Laster ansatte...</div>}>
      <EmployeesClient />
    </Suspense>
  );
}
