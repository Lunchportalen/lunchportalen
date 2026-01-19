// app/superadmin/page.tsx
import StatusCards from "@/components/superadmin/StatusCards";
import AlertsTable from "@/components/superadmin/AlertsTable";

export const revalidate = 30;

export default function SuperadminDashboard() {
  return (
    <div className="space-y-6">
      <StatusCards />
      <AlertsTable />
    </div>
  );
}
