"use client";

import UserAllergenProfileForm from "@/components/employee/UserAllergenProfileForm";

export default function WeekAllergenProfileCard() {
  return (
    <section
      className="mb-6 rounded-[1.75rem] bg-white/90 px-4 py-5 text-center shadow-[0_12px_40px_rgba(24,20,16,0.06)] ring-1 ring-black/5"
      aria-labelledby="week-allergen-heading"
    >
      <h2 id="week-allergen-heading" className="text-base font-semibold tracking-tight text-neutral-950 md:text-lg">
        Dine allergener — sendes som info til kjøkkenet
      </h2>
      <UserAllergenProfileForm />
    </section>
  );
}
