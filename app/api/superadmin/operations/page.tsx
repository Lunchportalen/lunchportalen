// app/superadmin/operations/page.tsx
import OperationsToday from "@/components/superadmin/OperationsToday";

export const revalidate = 15;

export default function OperationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dagens leveranser</h1>
      <OperationsToday />
    </div>
  );
}
