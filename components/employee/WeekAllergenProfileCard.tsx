"use client";

import UserAllergenProfileForm from "@/components/employee/UserAllergenProfileForm";

export default function WeekAllergenProfileCard() {
  return (
    <section
      className="mb-6 rounded-[1.75rem] bg-white/90 px-4 py-5 text-center shadow-[0_12px_40px_rgba(24,20,16,0.06)] ring-1 ring-black/5"
      aria-labelledby="week-allergen-heading"
    >
      <h2 id="week-allergen-heading" className="text-base font-semibold tracking-tight text-neutral-950 md:text-lg">
        Dine allergener
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-700">
        Fortell oss hva du ikke tåler — så tar kjøkkenet hensyn til det når vi lager maten din.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
        Vi vil at alle skal kunne senke skuldrene og nyte lunsjen. Det du krysser av her følger rett til kjøkkenet vårt.
      </p>
      <UserAllergenProfileForm />
    </section>
  );
}
