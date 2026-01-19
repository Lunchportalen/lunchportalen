// app/admin/kitchen-test/page.tsx
import KitchenRpcTestClient from "./test-client";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Kitchen RPC test</h1>
      <p className="mt-2 text-sm opacity-70">
        Denne siden tester get_kitchen_orders fra en innlogget bruker.
      </p>

      <div className="mt-6">
        <KitchenRpcTestClient />
      </div>
    </main>
  );
}
