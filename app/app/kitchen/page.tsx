import KitchenView from "./kitchenView";

export const revalidate = 30;

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6 print:p-0">
      <h1 className="mb-6 text-3xl font-semibold">Kjøkken – dagens bestillinger</h1>
      <KitchenView />
    </main>
  );
}
