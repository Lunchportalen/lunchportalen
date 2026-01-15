import WeekClient from "./WeekClient";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Ukemeny</h1>
        <p className="mt-2 text-sm opacity-70">
          Dette er en forhåndsvisning (Man–Fre). Bestilling gjøres kun på “I dag”-siden innen kl. 08:00.
        </p>
      </div>

      <WeekClient />
    </main>
  );
}
