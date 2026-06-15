import { EMPLOYEE_INVITE_TTL_MS } from "@/lib/invites/employeeInviteConstants";

const inviteHours = Math.round(EMPLOYEE_INVITE_TTL_MS / (1000 * 60 * 60));

export const EMPLOYEE_ACTIVATION_STATUS_BADGE = "Du er invitert";
export const EMPLOYEE_ACTIVATION_STATUS_LABEL = "Ansattinvitasjon";
export const EMPLOYEE_ACTIVATION_PAGE_EYEBROW = "Firmalunsj";
export const EMPLOYEE_ACTIVATION_PAGE_TITLE = "Opprett ansattkonto";
export const EMPLOYEE_ACTIVATION_ROLE_LABEL = "Ansatt";
export const EMPLOYEE_ACTIVATION_FORM_TITLE = "Fullfør kontoen";
export const EMPLOYEE_ACTIVATION_FORM_LEAD = "Bruk e-postadressen invitasjonen ble sendt til.";
export const EMPLOYEE_ACTIVATION_CTA_EMAIL = "Opprett ansattkonto";
export const EMPLOYEE_ACTIVATION_CTA_FORM = "Fullfør og gå til ukemenyen";
export const EMPLOYEE_ACTIVATION_FORM_BUSY = "Fullfører …";

export const EMPLOYEE_ACTIVATION_LEAD =
  "Opprett ansattkontoen din for å se ukemenyen, velge lunsj og administrere dine egne bestillinger.";

export const EMPLOYEE_ACTIVATION_NEXT_STEPS = [
  "Opprett passord",
  "Se ukens meny",
  "Bestill før cut-off",
] as const;

export const EMPLOYEE_ACTIVATION_SECURITY_NOTE =
  "Lenken er personlig, tidsbegrenset og skal ikke videresendes.";

export const EMPLOYEE_ACTIVATION_SECURITY_NOTE_PAGE = "Dette er en personlig invitasjon.";

export const EMPLOYEE_ACTIVATION_EXPIRY_NOTE = `Lenken er gyldig i ${inviteHours} timer. Hvis lenken er utløpt, kan administrator sende deg en ny invitasjon.`;

export const EMPLOYEE_ACTIVATION_UNEXPECTED_NOTE =
  "Hvis du ikke forventet denne invitasjonen, kan du ignorere e-posten.";

export const EMPLOYEE_ACTIVATION_SUPPORT_NOTE =
  "Trenger du hjelp? Kontakt administrator i bedriften din.";

export const EMPLOYEE_INVITE_UNAVAILABLE_TITLE = "Invitasjonen kan ikke brukes";
export const EMPLOYEE_INVITE_UNAVAILABLE_COPY =
  "Lenken kan være utløpt eller allerede brukt. Be administrator sende deg en ny invitasjon.";

export const EMPLOYEE_ACTIVATION_EMAIL_HERO = "Velkommen til Lunchportalen";

export function employeeActivationHeroSubtitle(companyName: string) {
  const name = String(companyName ?? "").trim();
  return name
    ? `${name} inviterer deg til å bestille firmalunsj digitalt.`
    : "Du er invitert til Lunchportalen";
}

export function employeeActivationPageLead(companyName: string) {
  const name = String(companyName ?? "").trim();
  return name
    ? `Se menyen, velg lunsj og administrer dine bestillinger hos ${name}.`
    : "Se menyen, velg lunsj og administrer dine bestillinger.";
}

export function employeeActivationEmailSubject(companyName: string) {
  const name = String(companyName ?? "").trim();
  return name
    ? `Du er invitert til firmalunsj hos ${name}`
    : "Du er invitert til Lunchportalen";
}

export function employeeActivationStatusSub(companyName: string) {
  const name = String(companyName ?? "").trim();
  return name ? `Firmalunsj hos ${name}` : "Firmalunsj i Lunchportalen";
}
