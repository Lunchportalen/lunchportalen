// app/superadmin/firms/page.tsx
import FirmsTable from "@/components/superadmin/FirmsTable";

export const revalidate = 30;

export default function FirmsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Firma</h1>
      <FirmsTable />
    </div>
  );
}
