import OnboardingForm from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Registrer firma</h1>
        <p className="mt-2 text-sm opacity-70">
          Opprett firmakonto (admin). Ansatte legges til av bedriften i etterkant.
        </p>
      </div>

      <OnboardingForm />
    </main>
  );
}
