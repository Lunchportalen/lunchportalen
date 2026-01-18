import WeekClient from "./WeekClient";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-10 pt-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text">Planlegg lunsj</h1>
        <p className="mt-2 text-sm text-muted">
          Endringer låses kl. <span className="font-medium text-text">08:00</span> samme dag.
        </p>
      </div>

      <WeekClient />
    </main>
  );
}
