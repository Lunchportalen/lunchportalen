// STATUS: KEEP

// app/onboarding/actions.ts
"use server";

import { redirect } from "next/navigation";

function clean(v: FormDataEntryValue | null) {
  return String(v ?? "").trim();
}

export async function submitOnboarding(formData: FormData) {
  const payload = {
    company_name: clean(formData.get("company_name")),
    orgnr: clean(formData.get("orgnr")),
    employee_count: Number(clean(formData.get("employee_count"))),

    full_name: clean(formData.get("admin_name")),
    email: clean(formData.get("admin_email")),
    phone: clean(formData.get("admin_phone")),

    password: clean(formData.get("password")),
    password_confirm: clean(formData.get("password_confirm")),
  };

  const res = await fetch("/api/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    const msg = encodeURIComponent(data?.message ?? "Registrering feilet");
    redirect(`/onboarding?error=${msg}`);
  }

  redirect(`/onboarding/thanks?status=${encodeURIComponent(data.status ?? "pending")}`);
}
