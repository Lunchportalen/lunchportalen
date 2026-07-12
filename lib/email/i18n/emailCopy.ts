/**
 * GLOBAL RELEASE GATE (Fase E5): localized transactional email copy.
 *
 * Locale chain for recipients (no cookie in email context):
 *   profiles.preferred_locale → companies.preferred_locale → market default → nb.
 *
 * nb strings are imported from the canonical copy modules (single source of truth);
 * other locales fall back per-template to `en`, then `nb`, so no email can ever
 * contain raw translation keys.
 */
import type { AppLocale } from "@/lib/i18n/middlewareLocale";

import {
  EMPLOYEE_ACTIVATION_CTA_EMAIL,
  EMPLOYEE_ACTIVATION_EMAIL_HERO,
  EMPLOYEE_ACTIVATION_EXPIRY_NOTE,
  EMPLOYEE_ACTIVATION_LEAD,
  EMPLOYEE_ACTIVATION_NEXT_STEPS,
  EMPLOYEE_ACTIVATION_ROLE_LABEL,
  EMPLOYEE_ACTIVATION_SECURITY_NOTE,
  EMPLOYEE_ACTIVATION_STATUS_BADGE,
  EMPLOYEE_ACTIVATION_STATUS_LABEL,
  EMPLOYEE_ACTIVATION_SUPPORT_NOTE,
  EMPLOYEE_ACTIVATION_UNEXPECTED_NOTE,
} from "@/lib/onboarding/employeeActivationCopy";

export type EmployeeInviteCopy = {
  subject: (companyName: string) => string;
  heroSubtitle: (companyName: string) => string;
  statusSub: (companyName: string) => string;
  hero: string;
  lead: string;
  statusBadge: string;
  statusLabel: string;
  roleLabel: string;
  cta: string;
  securityNote: string;
  expiryNote: string;
  expiredHint: string;
  unexpectedNote: string;
  supportNote: string;
  nextSteps: readonly [string, string, string];
  labels: { company: string; role: string; provider: string; location: string; nextStep: string; createAccount: string; summary: string; whatHappensNext: string };
};

export type PasswordResetCopy = {
  subject: string;
  greeting: string;
  intro: string;
  linkLead: string;
  validityNote: string;
  signoff: string;
};

function named(companyName: string, withName: (n: string) => string, without: string): string {
  const name = String(companyName ?? "").trim();
  return name ? withName(name) : without;
}

/* =========================================================
   Employee invite
========================================================= */

const INVITE_NB: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Du er invitert til firmalunsj hos ${n}`, "Du er invitert til Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} inviterer deg til å bestille firmalunsj digitalt.`, "Du er invitert til Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Firmalunsj hos ${n}`, "Firmalunsj i Lunchportalen"),
  hero: EMPLOYEE_ACTIVATION_EMAIL_HERO,
  lead: EMPLOYEE_ACTIVATION_LEAD,
  statusBadge: EMPLOYEE_ACTIVATION_STATUS_BADGE,
  statusLabel: EMPLOYEE_ACTIVATION_STATUS_LABEL,
  roleLabel: EMPLOYEE_ACTIVATION_ROLE_LABEL,
  cta: EMPLOYEE_ACTIVATION_CTA_EMAIL,
  securityNote: EMPLOYEE_ACTIVATION_SECURITY_NOTE,
  expiryNote: EMPLOYEE_ACTIVATION_EXPIRY_NOTE,
  expiredHint: "Hvis lenken er utløpt, kan administrator sende deg en ny invitasjon.",
  unexpectedNote: EMPLOYEE_ACTIVATION_UNEXPECTED_NOTE,
  supportNote: EMPLOYEE_ACTIVATION_SUPPORT_NOTE,
  nextSteps: EMPLOYEE_ACTIVATION_NEXT_STEPS as unknown as readonly [string, string, string],
  labels: { company: "Bedrift", role: "Rolle", provider: "Leverandør", location: "Lokasjon", nextStep: "Neste steg", createAccount: "Opprett konto", summary: "Oppsummering", whatHappensNext: "Dette skjer videre" },
};

const INVITE_EN: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `You are invited to company lunch at ${n}`, "You are invited to Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} invites you to order company lunch digitally.`, "You are invited to Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Company lunch at ${n}`, "Company lunch in Lunchportalen"),
  hero: "Welcome to Lunchportalen",
  lead: "Create your employee account to see the weekly menu, choose lunch and manage your own orders.",
  statusBadge: "You are invited",
  statusLabel: "Employee invitation",
  roleLabel: "Employee",
  cta: "Create employee account",
  securityNote: "The link is personal, time-limited and must not be forwarded.",
  expiryNote: "The link is valid for 72 hours. If it has expired, your administrator can send you a new invitation.",
  expiredHint: "If the link has expired, your administrator can send you a new invitation.",
  unexpectedNote: "If you did not expect this invitation, you can ignore this email.",
  supportNote: "Need help? Contact the administrator in your company.",
  nextSteps: ["Create a password", "See this week's menu", "Order before the cutoff"],
  labels: { company: "Company", role: "Role", provider: "Provider", location: "Location", nextStep: "Next step", createAccount: "Create account", summary: "Summary", whatHappensNext: "What happens next" },
};

const INVITE_SV: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Du är inbjuden till företagslunch hos ${n}`, "Du är inbjuden till Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} bjuder in dig att beställa företagslunch digitalt.`, "Du är inbjuden till Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Företagslunch hos ${n}`, "Företagslunch i Lunchportalen"),
  hero: "Välkommen till Lunchportalen",
  lead: "Skapa ditt medarbetarkonto för att se veckomenyn, välja lunch och hantera dina egna beställningar.",
  statusBadge: "Du är inbjuden",
  statusLabel: "Medarbetarinbjudan",
  roleLabel: "Medarbetare",
  cta: "Skapa medarbetarkonto",
  securityNote: "Länken är personlig, tidsbegränsad och får inte vidarebefordras.",
  expiryNote: "Länken är giltig i 72 timmar. Om den har gått ut kan administratören skicka en ny inbjudan.",
  expiredHint: "Om länken har gått ut kan administratören skicka en ny inbjudan.",
  unexpectedNote: "Om du inte väntade dig den här inbjudan kan du ignorera mejlet.",
  supportNote: "Behöver du hjälp? Kontakta administratören i ditt företag.",
  nextSteps: ["Skapa lösenord", "Se veckans meny", "Beställ före stopptiden"],
  labels: { company: "Företag", role: "Roll", provider: "Leverantör", location: "Plats", nextStep: "Nästa steg", createAccount: "Skapa konto", summary: "Sammanfattning", whatHappensNext: "Detta händer sedan" },
};

const INVITE_DA: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Du er inviteret til firmafrokost hos ${n}`, "Du er inviteret til Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} inviterer dig til at bestille firmafrokost digitalt.`, "Du er inviteret til Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Firmafrokost hos ${n}`, "Firmafrokost i Lunchportalen"),
  hero: "Velkommen til Lunchportalen",
  lead: "Opret din medarbejderkonto for at se ugemenuen, vælge frokost og administrere dine egne bestillinger.",
  statusBadge: "Du er inviteret",
  statusLabel: "Medarbejderinvitation",
  roleLabel: "Medarbejder",
  cta: "Opret medarbejderkonto",
  securityNote: "Linket er personligt, tidsbegrænset og må ikke videresendes.",
  expiryNote: "Linket er gyldigt i 72 timer. Hvis det er udløbet, kan administratoren sende dig en ny invitation.",
  expiredHint: "Hvis linket er udløbet, kan administratoren sende dig en ny invitation.",
  unexpectedNote: "Hvis du ikke forventede denne invitation, kan du ignorere denne e-mail.",
  supportNote: "Brug for hjælp? Kontakt administratoren i din virksomhed.",
  nextSteps: ["Opret adgangskode", "Se ugens menu", "Bestil før fristen"],
  labels: { company: "Virksomhed", role: "Rolle", provider: "Leverandør", location: "Lokation", nextStep: "Næste trin", createAccount: "Opret konto", summary: "Oversigt", whatHappensNext: "Det sker der nu" },
};

const INVITE_DE: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Sie sind zum Firmenlunch bei ${n} eingeladen`, "Sie sind zu Lunchportalen eingeladen"),
  heroSubtitle: (c) => named(c, (n) => `${n} lädt Sie ein, Firmenlunch digital zu bestellen.`, "Sie sind zu Lunchportalen eingeladen"),
  statusSub: (c) => named(c, (n) => `Firmenlunch bei ${n}`, "Firmenlunch in Lunchportalen"),
  hero: "Willkommen bei Lunchportalen",
  lead: "Erstellen Sie Ihr Mitarbeiterkonto, um das Wochenmenü zu sehen, Ihr Mittagessen zu wählen und Ihre Bestellungen zu verwalten.",
  statusBadge: "Sie sind eingeladen",
  statusLabel: "Mitarbeitereinladung",
  roleLabel: "Mitarbeiter:in",
  cta: "Mitarbeiterkonto erstellen",
  securityNote: "Der Link ist persönlich, zeitlich begrenzt und darf nicht weitergeleitet werden.",
  expiryNote: "Der Link ist 72 Stunden gültig. Ist er abgelaufen, kann Ihnen der Administrator eine neue Einladung senden.",
  expiredHint: "Ist der Link abgelaufen, kann Ihnen der Administrator eine neue Einladung senden.",
  unexpectedNote: "Wenn Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.",
  supportNote: "Brauchen Sie Hilfe? Wenden Sie sich an den Administrator in Ihrem Unternehmen.",
  nextSteps: ["Passwort erstellen", "Wochenmenü ansehen", "Vor der Frist bestellen"],
  labels: { company: "Unternehmen", role: "Rolle", provider: "Anbieter", location: "Standort", nextStep: "Nächster Schritt", createAccount: "Konto erstellen", summary: "Zusammenfassung", whatHappensNext: "So geht es weiter" },
};

const INVITE_FR: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Vous êtes invité au déjeuner d'entreprise chez ${n}`, "Vous êtes invité sur Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} vous invite à commander votre déjeuner d'entreprise en ligne.`, "Vous êtes invité sur Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Déjeuner d'entreprise chez ${n}`, "Déjeuner d'entreprise sur Lunchportalen"),
  hero: "Bienvenue sur Lunchportalen",
  lead: "Créez votre compte employé pour consulter le menu de la semaine, choisir votre déjeuner et gérer vos commandes.",
  statusBadge: "Vous êtes invité",
  statusLabel: "Invitation employé",
  roleLabel: "Employé",
  cta: "Créer un compte employé",
  securityNote: "Le lien est personnel, limité dans le temps et ne doit pas être transféré.",
  expiryNote: "Le lien est valable 72 heures. S'il a expiré, votre administrateur peut vous envoyer une nouvelle invitation.",
  expiredHint: "Si le lien a expiré, votre administrateur peut vous envoyer une nouvelle invitation.",
  unexpectedNote: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
  supportNote: "Besoin d'aide ? Contactez l'administrateur de votre entreprise.",
  nextSteps: ["Créer un mot de passe", "Voir le menu de la semaine", "Commander avant l'heure limite"],
  labels: { company: "Entreprise", role: "Rôle", provider: "Fournisseur", location: "Site", nextStep: "Étape suivante", createAccount: "Créer un compte", summary: "Résumé", whatHappensNext: "La suite" },
};

const INVITE_ES: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Estás invitado al almuerzo de empresa en ${n}`, "Estás invitado a Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} te invita a pedir el almuerzo de empresa digitalmente.`, "Estás invitado a Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Almuerzo de empresa en ${n}`, "Almuerzo de empresa en Lunchportalen"),
  hero: "Bienvenido a Lunchportalen",
  lead: "Crea tu cuenta de empleado para ver el menú semanal, elegir tu almuerzo y gestionar tus pedidos.",
  statusBadge: "Estás invitado",
  statusLabel: "Invitación de empleado",
  roleLabel: "Empleado",
  cta: "Crear cuenta de empleado",
  securityNote: "El enlace es personal, tiene tiempo limitado y no debe reenviarse.",
  expiryNote: "El enlace es válido durante 72 horas. Si ha caducado, tu administrador puede enviarte una nueva invitación.",
  expiredHint: "Si el enlace ha caducado, tu administrador puede enviarte una nueva invitación.",
  unexpectedNote: "Si no esperabas esta invitación, puedes ignorar este correo.",
  supportNote: "¿Necesitas ayuda? Contacta con el administrador de tu empresa.",
  nextSteps: ["Crear contraseña", "Ver el menú de la semana", "Pedir antes del cierre"],
  labels: { company: "Empresa", role: "Rol", provider: "Proveedor", location: "Ubicación", nextStep: "Siguiente paso", createAccount: "Crear cuenta", summary: "Resumen", whatHappensNext: "Qué sigue" },
};

const INVITE_IT: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Sei invitato al pranzo aziendale di ${n}`, "Sei invitato su Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} ti invita a ordinare il pranzo aziendale online.`, "Sei invitato su Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Pranzo aziendale presso ${n}`, "Pranzo aziendale su Lunchportalen"),
  hero: "Benvenuto su Lunchportalen",
  lead: "Crea il tuo account dipendente per vedere il menù settimanale, scegliere il pranzo e gestire i tuoi ordini.",
  statusBadge: "Sei invitato",
  statusLabel: "Invito dipendente",
  roleLabel: "Dipendente",
  cta: "Crea account dipendente",
  securityNote: "Il link è personale, a tempo limitato e non deve essere inoltrato.",
  expiryNote: "Il link è valido per 72 ore. Se è scaduto, l'amministratore può inviarti un nuovo invito.",
  expiredHint: "Se il link è scaduto, l'amministratore può inviarti un nuovo invito.",
  unexpectedNote: "Se non ti aspettavi questo invito, puoi ignorare questa e-mail.",
  supportNote: "Serve aiuto? Contatta l'amministratore della tua azienda.",
  nextSteps: ["Crea una password", "Guarda il menù della settimana", "Ordina entro l'orario limite"],
  labels: { company: "Azienda", role: "Ruolo", provider: "Fornitore", location: "Sede", nextStep: "Prossimo passo", createAccount: "Crea account", summary: "Riepilogo", whatHappensNext: "Cosa succede dopo" },
};

const INVITE_FI: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Sinut on kutsuttu yrityslounaalle: ${n}`, "Sinut on kutsuttu Lunchportaleniin"),
  heroSubtitle: (c) => named(c, (n) => `${n} kutsuu sinut tilaamaan yrityslounaan digitaalisesti.`, "Sinut on kutsuttu Lunchportaleniin"),
  statusSub: (c) => named(c, (n) => `Yrityslounas: ${n}`, "Yrityslounas Lunchportalenissa"),
  hero: "Tervetuloa Lunchportaleniin",
  lead: "Luo työntekijätilisi nähdäksesi viikon ruokalistan, valitaksesi lounaan ja hallitaksesi omia tilauksiasi.",
  statusBadge: "Sinut on kutsuttu",
  statusLabel: "Työntekijäkutsu",
  roleLabel: "Työntekijä",
  cta: "Luo työntekijätili",
  securityNote: "Linkki on henkilökohtainen, määräaikainen eikä sitä saa välittää eteenpäin.",
  expiryNote: "Linkki on voimassa 72 tuntia. Jos linkki on vanhentunut, järjestelmänvalvoja voi lähettää sinulle uuden kutsun.",
  expiredHint: "Jos linkki on vanhentunut, järjestelmänvalvoja voi lähettää uuden kutsun.",
  unexpectedNote: "Jos et odottanut tätä kutsua, voit jättää tämän viestin huomiotta.",
  supportNote: "Tarvitsetko apua? Ota yhteyttä yrityksesi järjestelmänvalvojaan.",
  nextSteps: ["Luo salasana", "Katso viikon ruokalista", "Tilaa ennen määräaikaa"],
  labels: { company: "Yritys", role: "Rooli", provider: "Toimittaja", location: "Toimipiste", nextStep: "Seuraava vaihe", createAccount: "Luo tili", summary: "Yhteenveto", whatHappensNext: "Näin jatkuu" },
};

const INVITE_NL: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Je bent uitgenodigd voor de bedrijfslunch bij ${n}`, "Je bent uitgenodigd voor Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} nodigt je uit om de bedrijfslunch digitaal te bestellen.`, "Je bent uitgenodigd voor Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Bedrijfslunch bij ${n}`, "Bedrijfslunch in Lunchportalen"),
  hero: "Welkom bij Lunchportalen",
  lead: "Maak je medewerkersaccount aan om het weekmenu te bekijken, je lunch te kiezen en je eigen bestellingen te beheren.",
  statusBadge: "Je bent uitgenodigd",
  statusLabel: "Medewerkersuitnodiging",
  roleLabel: "Medewerker",
  cta: "Medewerkersaccount aanmaken",
  securityNote: "De link is persoonlijk, tijdelijk geldig en mag niet worden doorgestuurd.",
  expiryNote: "De link is 72 uur geldig. Als de link is verlopen, kan de beheerder je een nieuwe uitnodiging sturen.",
  expiredHint: "Als de link is verlopen, kan de beheerder je een nieuwe uitnodiging sturen.",
  unexpectedNote: "Als je deze uitnodiging niet verwachtte, kun je deze e-mail negeren.",
  supportNote: "Hulp nodig? Neem contact op met de beheerder in je bedrijf.",
  nextSteps: ["Maak een wachtwoord aan", "Bekijk het menu van deze week", "Bestel vóór de deadline"],
  labels: { company: "Bedrijf", role: "Rol", provider: "Leverancier", location: "Locatie", nextStep: "Volgende stap", createAccount: "Account aanmaken", summary: "Samenvatting", whatHappensNext: "Wat gebeurt er nu" },
};

const EMPLOYEE_INVITE_COPY: Record<AppLocale, EmployeeInviteCopy> = {
  nb: INVITE_NB,
  en: INVITE_EN,
  sv: INVITE_SV,
  da: INVITE_DA,
  de: INVITE_DE,
  fr: INVITE_FR,
  es: INVITE_ES,
  it: INVITE_IT,
  fi: INVITE_FI,
  nl: INVITE_NL,
};

/* =========================================================
   Password reset
========================================================= */

const RESET_COPY: Record<AppLocale, PasswordResetCopy> = {
  nb: {
    subject: "Tilbakestill passordet ditt i Lunchportalen",
    greeting: "Hei,",
    intro: "Du ba om å tilbakestille passordet ditt i Lunchportalen.",
    linkLead: "Bruk lenken under for å velge nytt passord:",
    validityNote: "Lenken er gyldig i 30 minutter. Hvis du ikke ba om dette, kan du se bort fra e-posten.",
    signoff: "Vennlig hilsen\nLunchportalen",
  },
  en: {
    subject: "Reset your Lunchportalen password",
    greeting: "Hi,",
    intro: "You requested a password reset for your Lunchportalen account.",
    linkLead: "Use the link below to choose a new password:",
    validityNote: "The link is valid for 30 minutes. If you did not request this, you can ignore this email.",
    signoff: "Best regards\nLunchportalen",
  },
  sv: {
    subject: "Återställ ditt lösenord i Lunchportalen",
    greeting: "Hej,",
    intro: "Du bad om att återställa ditt lösenord i Lunchportalen.",
    linkLead: "Använd länken nedan för att välja ett nytt lösenord:",
    validityNote: "Länken är giltig i 30 minuter. Om du inte bad om detta kan du ignorera mejlet.",
    signoff: "Vänliga hälsningar\nLunchportalen",
  },
  da: {
    subject: "Nulstil din adgangskode i Lunchportalen",
    greeting: "Hej,",
    intro: "Du bad om at nulstille din adgangskode i Lunchportalen.",
    linkLead: "Brug linket nedenfor til at vælge en ny adgangskode:",
    validityNote: "Linket er gyldigt i 30 minutter. Hvis du ikke bad om dette, kan du ignorere denne e-mail.",
    signoff: "Venlig hilsen\nLunchportalen",
  },
  de: {
    subject: "Setzen Sie Ihr Lunchportalen-Passwort zurück",
    greeting: "Hallo,",
    intro: "Sie haben das Zurücksetzen Ihres Passworts bei Lunchportalen angefordert.",
    linkLead: "Verwenden Sie den folgenden Link, um ein neues Passwort zu wählen:",
    validityNote: "Der Link ist 30 Minuten gültig. Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.",
    signoff: "Mit freundlichen Grüßen\nLunchportalen",
  },
  fr: {
    subject: "Réinitialisez votre mot de passe Lunchportalen",
    greeting: "Bonjour,",
    intro: "Vous avez demandé la réinitialisation de votre mot de passe Lunchportalen.",
    linkLead: "Utilisez le lien ci-dessous pour choisir un nouveau mot de passe :",
    validityNote: "Le lien est valable 30 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
    signoff: "Cordialement\nLunchportalen",
  },
  es: {
    subject: "Restablece tu contraseña de Lunchportalen",
    greeting: "Hola:",
    intro: "Has solicitado restablecer tu contraseña de Lunchportalen.",
    linkLead: "Usa el siguiente enlace para elegir una nueva contraseña:",
    validityNote: "El enlace es válido durante 30 minutos. Si no lo solicitaste, puedes ignorar este correo.",
    signoff: "Un saludo\nLunchportalen",
  },
  it: {
    subject: "Reimposta la tua password di Lunchportalen",
    greeting: "Ciao,",
    intro: "Hai richiesto di reimpostare la tua password di Lunchportalen.",
    linkLead: "Usa il link qui sotto per scegliere una nuova password:",
    validityNote: "Il link è valido per 30 minuti. Se non hai richiesto tu questa operazione, puoi ignorare questa e-mail.",
    signoff: "Cordiali saluti\nLunchportalen",
  },
  fi: {
    subject: "Vaihda Lunchportalen-salasanasi",
    greeting: "Hei,",
    intro: "Pyysit salasanan vaihtoa Lunchportalen-tilillesi.",
    linkLead: "Valitse uusi salasana alla olevasta linkistä:",
    validityNote: "Linkki on voimassa 30 minuuttia. Jos et pyytänyt tätä, voit jättää viestin huomiotta.",
    signoff: "Ystävällisin terveisin\nLunchportalen",
  },
  nl: {
    subject: "Stel je Lunchportalen-wachtwoord opnieuw in",
    greeting: "Hallo,",
    intro: "Je hebt gevraagd om je wachtwoord voor Lunchportalen opnieuw in te stellen.",
    linkLead: "Gebruik de onderstaande link om een nieuw wachtwoord te kiezen:",
    validityNote: "De link is 30 minuten geldig. Als je dit niet hebt aangevraagd, kun je deze e-mail negeren.",
    signoff: "Met vriendelijke groet\nLunchportalen",
  },
};

/* =========================================================
   Accessors (fail-closed: unknown locale → nb)
========================================================= */

export function employeeInviteCopy(locale: AppLocale | string | null | undefined): EmployeeInviteCopy {
  const key = String(locale ?? "").trim() as AppLocale;
  return EMPLOYEE_INVITE_COPY[key] ?? INVITE_NB;
}

export function passwordResetCopy(locale: AppLocale | string | null | undefined): PasswordResetCopy {
  const key = String(locale ?? "").trim() as AppLocale;
  return RESET_COPY[key] ?? RESET_COPY.nb;
}
