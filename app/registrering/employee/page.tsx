// app/registrering/employee/page.tsx
import EmployeeRegisterClient from "./register-client";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterEmployeePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const inviteRaw = sp.invite;

  const invite =
    typeof inviteRaw === "string"
      ? inviteRaw.trim()
      : Array.isArray(inviteRaw)
      ? String(inviteRaw[0] ?? "").trim()
      : "";

  return <EmployeeRegisterClient invite={invite} />;
}
