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

const INVITE_PL: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Zaproszenie na firmowy lunch w ${n}`, "Zaproszenie do Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} zaprasza Cię do cyfrowego zamawiania firmowego lunchu.`, "Zaproszenie do Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Firmowy lunch w ${n}`, "Firmowy lunch w Lunchportalen"),
  hero: "Witamy w Lunchportalen",
  lead: "Utwórz konto pracownika, aby zobaczyć menu tygodnia, wybrać lunch i zarządzać własnymi zamówieniami.",
  statusBadge: "Masz zaproszenie",
  statusLabel: "Zaproszenie dla pracownika",
  roleLabel: "Pracownik",
  cta: "Utwórz konto pracownika",
  securityNote: "Link jest osobisty, ograniczony czasowo i nie wolno go przekazywać dalej.",
  expiryNote: "Link jest ważny przez 72 godziny. Jeśli wygasł, administrator może wysłać Ci nowe zaproszenie.",
  expiredHint: "Jeśli link wygasł, administrator może wysłać Ci nowe zaproszenie.",
  unexpectedNote: "Jeśli nie spodziewasz się tego zaproszenia, możesz zignorować tę wiadomość.",
  supportNote: "Potrzebujesz pomocy? Skontaktuj się z administratorem w swojej firmie.",
  nextSteps: ["Utwórz hasło", "Zobacz menu tygodnia", "Zamów przed terminem"],
  labels: { company: "Firma", role: "Rola", provider: "Dostawca", location: "Lokalizacja", nextStep: "Następny krok", createAccount: "Utwórz konto", summary: "Podsumowanie", whatHappensNext: "Co dalej" },
};

const INVITE_RO: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Ești invitat la prânzul de companie la ${n}`, "Ești invitat pe Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} te invită să comanzi prânzul de companie digital.`, "Ești invitat pe Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Prânz de companie la ${n}`, "Prânz de companie pe Lunchportalen"),
  hero: "Bine ai venit pe Lunchportalen",
  lead: "Creează-ți contul de angajat pentru a vedea meniul săptămânal, a alege prânzul și a-ți gestiona propriile comenzi.",
  statusBadge: "Ești invitat",
  statusLabel: "Invitație pentru angajat",
  roleLabel: "Angajat",
  cta: "Creează cont de angajat",
  securityNote: "Linkul este personal, limitat în timp și nu trebuie redirecționat.",
  expiryNote: "Linkul este valabil 72 de ore. Dacă a expirat, administratorul îți poate trimite o nouă invitație.",
  expiredHint: "Dacă linkul a expirat, administratorul îți poate trimite o nouă invitație.",
  unexpectedNote: "Dacă nu așteptai această invitație, poți ignora acest e-mail.",
  supportNote: "Ai nevoie de ajutor? Contactează administratorul din compania ta.",
  nextSteps: ["Creează o parolă", "Vezi meniul săptămânii", "Comandă înainte de termenul-limită"],
  labels: { company: "Companie", role: "Rol", provider: "Furnizor", location: "Locație", nextStep: "Pasul următor", createAccount: "Creează cont", summary: "Rezumat", whatHappensNext: "Ce urmează" },
};

const INVITE_CS: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Máte pozvánku na firemní oběd u ${n}`, "Máte pozvánku do Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `${n} vás zve k digitálnímu objednávání firemních obědů.`, "Máte pozvánku do Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Firemní oběd u ${n}`, "Firemní oběd v Lunchportalen"),
  hero: "Vítejte v Lunchportalen",
  lead: "Vytvořte si zaměstnanecký účet, abyste viděli týdenní menu, vybrali si oběd a spravovali své objednávky.",
  statusBadge: "Máte pozvánku",
  statusLabel: "Pozvánka pro zaměstnance",
  roleLabel: "Zaměstnanec",
  cta: "Vytvořit zaměstnanecký účet",
  securityNote: "Odkaz je osobní, časově omezený a nesmí být přeposílán.",
  expiryNote: "Odkaz je platný 72 hodin. Pokud vypršel, administrátor vám může poslat novou pozvánku.",
  expiredHint: "Pokud odkaz vypršel, administrátor vám může poslat novou pozvánku.",
  unexpectedNote: "Pokud jste tuto pozvánku nečekali, můžete tento e-mail ignorovat.",
  supportNote: "Potřebujete pomoc? Obraťte se na administrátora ve vaší společnosti.",
  nextSteps: ["Vytvořte si heslo", "Podívejte se na menu tohoto týdne", "Objednejte před uzávěrkou"],
  labels: { company: "Společnost", role: "Role", provider: "Dodavatel", location: "Pobočka", nextStep: "Další krok", createAccount: "Vytvořit účet", summary: "Shrnutí", whatHappensNext: "Co bude dál" },
};

const INVITE_PT: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Foi convidado para o almoço de empresa na ${n}`, "Foi convidado para o Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `A ${n} convida-o a encomendar o almoço de empresa digitalmente.`, "Foi convidado para o Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Almoço de empresa na ${n}`, "Almoço de empresa no Lunchportalen"),
  hero: "Bem-vindo ao Lunchportalen",
  lead: "Crie a sua conta de colaborador para ver o menu semanal, escolher o almoço e gerir os seus pedidos.",
  statusBadge: "Foi convidado",
  statusLabel: "Convite de colaborador",
  roleLabel: "Colaborador",
  cta: "Criar conta de colaborador",
  securityNote: "A ligação é pessoal, tem validade limitada e não deve ser reencaminhada.",
  expiryNote: "A ligação é válida durante 72 horas. Se tiver expirado, o administrador pode enviar-lhe um novo convite.",
  expiredHint: "Se a ligação tiver expirado, o administrador pode enviar-lhe um novo convite.",
  unexpectedNote: "Se não esperava este convite, pode ignorar este e-mail.",
  supportNote: "Precisa de ajuda? Contacte o administrador da sua empresa.",
  nextSteps: ["Criar uma palavra-passe", "Ver o menu desta semana", "Pedir antes da hora-limite"],
  labels: { company: "Empresa", role: "Função", provider: "Fornecedor", location: "Localização", nextStep: "Próximo passo", createAccount: "Criar conta", summary: "Resumo", whatHappensNext: "O que acontece a seguir" },
};

const INVITE_EL: EmployeeInviteCopy = {
  subject: (c) => named(c, (n) => `Έχετε πρόσκληση για εταιρικό γεύμα στην ${n}`, "Έχετε πρόσκληση στο Lunchportalen"),
  heroSubtitle: (c) => named(c, (n) => `Η ${n} σας προσκαλεί να παραγγέλνετε το εταιρικό γεύμα ψηφιακά.`, "Έχετε πρόσκληση στο Lunchportalen"),
  statusSub: (c) => named(c, (n) => `Εταιρικό γεύμα στην ${n}`, "Εταιρικό γεύμα στο Lunchportalen"),
  hero: "Καλώς ήρθατε στο Lunchportalen",
  lead: "Δημιουργήστε τον λογαριασμό εργαζομένου για να βλέπετε το εβδομαδιαίο μενού, να επιλέγετε γεύμα και να διαχειρίζεστε τις παραγγελίες σας.",
  statusBadge: "Έχετε πρόσκληση",
  statusLabel: "Πρόσκληση εργαζομένου",
  roleLabel: "Εργαζόμενος",
  cta: "Δημιουργία λογαριασμού εργαζομένου",
  securityNote: "Ο σύνδεσμος είναι προσωπικός, με χρονικό όριο, και δεν πρέπει να προωθηθεί.",
  expiryNote: "Ο σύνδεσμος ισχύει για 72 ώρες. Αν έχει λήξει, ο διαχειριστής μπορεί να σας στείλει νέα πρόσκληση.",
  expiredHint: "Αν ο σύνδεσμος έχει λήξει, ο διαχειριστής μπορεί να σας στείλει νέα πρόσκληση.",
  unexpectedNote: "Αν δεν περιμένατε αυτήν την πρόσκληση, μπορείτε να αγνοήσετε αυτό το e-mail.",
  supportNote: "Χρειάζεστε βοήθεια; Επικοινωνήστε με τον διαχειριστή της εταιρείας σας.",
  nextSteps: ["Δημιουργήστε κωδικό πρόσβασης", "Δείτε το μενού της εβδομάδας", "Παραγγείλετε πριν από την προθεσμία"],
  labels: { company: "Εταιρεία", role: "Ρόλος", provider: "Προμηθευτής", location: "Τοποθεσία", nextStep: "Επόμενο βήμα", createAccount: "Δημιουργία λογαριασμού", summary: "Σύνοψη", whatHappensNext: "Τι ακολουθεί" },
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
  pl: INVITE_PL,
  ro: INVITE_RO,
  cs: INVITE_CS,
  pt: INVITE_PT,
  el: INVITE_EL,
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
  pl: {
    subject: "Zresetuj swoje hasło w Lunchportalen",
    greeting: "Cześć,",
    intro: "Poprosiłeś(-aś) o zresetowanie hasła do konta Lunchportalen.",
    linkLead: "Użyj poniższego linku, aby wybrać nowe hasło:",
    validityNote: "Link jest ważny przez 30 minut. Jeśli to nie Ty prosiłeś(-aś) o zmianę, zignoruj tę wiadomość.",
    signoff: "Z pozdrowieniami\nLunchportalen",
  },
  ro: {
    subject: "Resetează-ți parola Lunchportalen",
    greeting: "Bună,",
    intro: "Ai solicitat resetarea parolei pentru contul tău Lunchportalen.",
    linkLead: "Folosește linkul de mai jos pentru a alege o parolă nouă:",
    validityNote: "Linkul este valabil 30 de minute. Dacă nu ai solicitat acest lucru, poți ignora acest e-mail.",
    signoff: "Cu stimă\nLunchportalen",
  },
  cs: {
    subject: "Obnovte si heslo do Lunchportalen",
    greeting: "Dobrý den,",
    intro: "Požádali jste o obnovení hesla ke svému účtu Lunchportalen.",
    linkLead: "Pomocí odkazu níže si zvolte nové heslo:",
    validityNote: "Odkaz je platný 30 minut. Pokud jste o to nepožádali, můžete tento e-mail ignorovat.",
    signoff: "S pozdravem\nLunchportalen",
  },
  pt: {
    subject: "Reponha a sua palavra-passe do Lunchportalen",
    greeting: "Olá,",
    intro: "Pediu a reposição da palavra-passe da sua conta Lunchportalen.",
    linkLead: "Use a ligação abaixo para escolher uma nova palavra-passe:",
    validityNote: "A ligação é válida durante 30 minutos. Se não fez este pedido, pode ignorar este e-mail.",
    signoff: "Com os melhores cumprimentos\nLunchportalen",
  },
  el: {
    subject: "Επαναφέρετε τον κωδικό πρόσβασής σας στο Lunchportalen",
    greeting: "Γεια σας,",
    intro: "Ζητήσατε επαναφορά του κωδικού πρόσβασης για τον λογαριασμό σας στο Lunchportalen.",
    linkLead: "Χρησιμοποιήστε τον παρακάτω σύνδεσμο για να επιλέξετε νέο κωδικό:",
    validityNote: "Ο σύνδεσμος ισχύει για 30 λεπτά. Αν δεν το ζητήσατε εσείς, μπορείτε να αγνοήσετε αυτό το e-mail.",
    signoff: "Με εκτίμηση\nLunchportalen",
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

/* =========================================================
   Company-approved (agreement approval) email copy.
   nb + en defined; other locales fall back en → nb (documented
   per-template policy) so no email contains raw keys.
========================================================= */

export type CompanyApprovedCopy = {
  subject: string;
  badge: string;
  hero: string;
  greeting: (contactName: string) => string;
  intro: (companyName: string) => string;
  activateLead: string;
  cta: string;
  expiryTitle: string;
  expiryNote: string;
  signoff: string;
};

const COMPANY_APPROVED_NB: CompanyApprovedCopy = {
  subject: "Velkommen til Lunchportalen \u2013 aktiver din konto",
  badge: "Avtale godkjent",
  hero: "Velkommen til Lunchportalen",
  greeting: (n) => `Hei ${n},`,
  intro: (c) => `Avtalen for ${c} er godkjent og klar til å aktiveres.`,
  activateLead: "Klikk på knappen nedenfor for å opprette din innlogging og komme i gang:",
  cta: "Aktiver konto",
  expiryTitle: "Lenken er gyldig i 7 dager.",
  expiryNote: "Dersom lenken utløper kan du kontakte oss for å få en ny.",
  signoff: "Med vennlig hilsen,\nLunchportalen-teamet",
};

const COMPANY_APPROVED_EN: CompanyApprovedCopy = {
  subject: "Welcome to Lunchportalen \u2013 activate your account",
  badge: "Agreement approved",
  hero: "Welcome to Lunchportalen",
  greeting: (n) => `Hi ${n},`,
  intro: (c) => `The agreement for ${c} has been approved and is ready to activate.`,
  activateLead: "Click the button below to create your login and get started:",
  cta: "Activate account",
  expiryTitle: "The link is valid for 7 days.",
  expiryNote: "If the link expires, contact us and we'll send a new one.",
  signoff: "Best regards,\nThe Lunchportalen team",
};

/* FASE 11: komplett 15/15 — ingen språk faller tilbake til engelsk. */
const COMPANY_APPROVED_COPY: Record<AppLocale, CompanyApprovedCopy> = {
  nb: COMPANY_APPROVED_NB,
  en: COMPANY_APPROVED_EN,
  sv: {
    subject: "Välkommen till Lunchportalen \u2013 aktivera ditt konto",
    badge: "Avtal godkänt",
    hero: "Välkommen till Lunchportalen",
    greeting: (n) => `Hej ${n},`,
    intro: (c) => `Avtalet för ${c} är godkänt och redo att aktiveras.`,
    activateLead: "Klicka på knappen nedan för att skapa din inloggning och komma igång:",
    cta: "Aktivera konto",
    expiryTitle: "Länken är giltig i 7 dagar.",
    expiryNote: "Om länken går ut kan du kontakta oss för att få en ny.",
    signoff: "Med vänliga hälsningar,\nLunchportalen-teamet",
  },
  da: {
    subject: "Velkommen til Lunchportalen \u2013 aktivér din konto",
    badge: "Aftale godkendt",
    hero: "Velkommen til Lunchportalen",
    greeting: (n) => `Hej ${n},`,
    intro: (c) => `Aftalen for ${c} er godkendt og klar til at blive aktiveret.`,
    activateLead: "Klik på knappen nedenfor for at oprette dit login og komme i gang:",
    cta: "Aktivér konto",
    expiryTitle: "Linket er gyldigt i 7 dage.",
    expiryNote: "Hvis linket udløber, kan du kontakte os for at få et nyt.",
    signoff: "Med venlig hilsen,\nLunchportalen-teamet",
  },
  fi: {
    subject: "Tervetuloa Lunchportaleniin \u2013 aktivoi tilisi",
    badge: "Sopimus hyväksytty",
    hero: "Tervetuloa Lunchportaleniin",
    greeting: (n) => `Hei ${n},`,
    intro: (c) => `Sopimus yritykselle ${c} on hyväksytty ja valmis aktivoitavaksi.`,
    activateLead: "Luo kirjautumistunnuksesi ja aloita napsauttamalla alla olevaa painiketta:",
    cta: "Aktivoi tili",
    expiryTitle: "Linkki on voimassa 7 päivää.",
    expiryNote: "Jos linkki vanhenee, ota yhteyttä, niin lähetämme uuden.",
    signoff: "Ystävällisin terveisin,\nLunchportalen-tiimi",
  },
  de: {
    subject: "Willkommen bei Lunchportalen \u2013 Konto aktivieren",
    badge: "Vertrag genehmigt",
    hero: "Willkommen bei Lunchportalen",
    greeting: (n) => `Hallo ${n},`,
    intro: (c) => `Der Vertrag für ${c} wurde genehmigt und kann aktiviert werden.`,
    activateLead: "Klicken Sie auf die Schaltfläche unten, um Ihren Zugang zu erstellen und loszulegen:",
    cta: "Konto aktivieren",
    expiryTitle: "Der Link ist 7 Tage gültig.",
    expiryNote: "Wenn der Link abläuft, kontaktieren Sie uns für einen neuen.",
    signoff: "Mit freundlichen Grüßen,\nDas Lunchportalen-Team",
  },
  fr: {
    subject: "Bienvenue sur Lunchportalen \u2013 activez votre compte",
    badge: "Contrat approuvé",
    hero: "Bienvenue sur Lunchportalen",
    greeting: (n) => `Bonjour ${n},`,
    intro: (c) => `Le contrat pour ${c} a été approuvé et est prêt à être activé.`,
    activateLead: "Cliquez sur le bouton ci-dessous pour créer votre identifiant et commencer :",
    cta: "Activer le compte",
    expiryTitle: "Le lien est valable 7 jours.",
    expiryNote: "Si le lien expire, contactez-nous pour en recevoir un nouveau.",
    signoff: "Cordialement,\nL'équipe Lunchportalen",
  },
  es: {
    subject: "Bienvenido a Lunchportalen \u2013 activa tu cuenta",
    badge: "Acuerdo aprobado",
    hero: "Bienvenido a Lunchportalen",
    greeting: (n) => `Hola ${n}:`,
    intro: (c) => `El acuerdo para ${c} ha sido aprobado y está listo para activarse.`,
    activateLead: "Haz clic en el botón de abajo para crear tu acceso y empezar:",
    cta: "Activar cuenta",
    expiryTitle: "El enlace es válido durante 7 días.",
    expiryNote: "Si el enlace caduca, contáctanos para recibir uno nuevo.",
    signoff: "Atentamente,\nEl equipo de Lunchportalen",
  },
  it: {
    subject: "Benvenuto su Lunchportalen \u2013 attiva il tuo account",
    badge: "Contratto approvato",
    hero: "Benvenuto su Lunchportalen",
    greeting: (n) => `Ciao ${n},`,
    intro: (c) => `Il contratto per ${c} è stato approvato ed è pronto per essere attivato.`,
    activateLead: "Fai clic sul pulsante qui sotto per creare il tuo accesso e iniziare:",
    cta: "Attiva account",
    expiryTitle: "Il link è valido per 7 giorni.",
    expiryNote: "Se il link scade, contattaci per riceverne uno nuovo.",
    signoff: "Cordiali saluti,\nIl team di Lunchportalen",
  },
  nl: {
    subject: "Welkom bij Lunchportalen \u2013 activeer je account",
    badge: "Overeenkomst goedgekeurd",
    hero: "Welkom bij Lunchportalen",
    greeting: (n) => `Hallo ${n},`,
    intro: (c) => `De overeenkomst voor ${c} is goedgekeurd en klaar om te activeren.`,
    activateLead: "Klik op de knop hieronder om je inlog aan te maken en te beginnen:",
    cta: "Account activeren",
    expiryTitle: "De link is 7 dagen geldig.",
    expiryNote: "Als de link verloopt, neem dan contact met ons op voor een nieuwe.",
    signoff: "Met vriendelijke groet,\nHet Lunchportalen-team",
  },
  pl: {
    subject: "Witamy w Lunchportalen \u2013 aktywuj swoje konto",
    badge: "Umowa zatwierdzona",
    hero: "Witamy w Lunchportalen",
    greeting: (n) => `Cześć ${n},`,
    intro: (c) => `Umowa dla ${c} została zatwierdzona i jest gotowa do aktywacji.`,
    activateLead: "Kliknij przycisk poniżej, aby utworzyć login i rozpocząć:",
    cta: "Aktywuj konto",
    expiryTitle: "Link jest ważny przez 7 dni.",
    expiryNote: "Jeśli link wygaśnie, skontaktuj się z nami, aby otrzymać nowy.",
    signoff: "Z poważaniem,\nZespół Lunchportalen",
  },
  ro: {
    subject: "Bine ați venit la Lunchportalen \u2013 activați-vă contul",
    badge: "Acord aprobat",
    hero: "Bine ați venit la Lunchportalen",
    greeting: (n) => `Bună, ${n},`,
    intro: (c) => `Acordul pentru ${c} a fost aprobat și este gata de activare.`,
    activateLead: "Faceți clic pe butonul de mai jos pentru a vă crea autentificarea și a începe:",
    cta: "Activați contul",
    expiryTitle: "Linkul este valabil 7 zile.",
    expiryNote: "Dacă linkul expiră, contactați-ne pentru a primi unul nou.",
    signoff: "Cu stimă,\nEchipa Lunchportalen",
  },
  cs: {
    subject: "Vítejte v Lunchportalen \u2013 aktivujte svůj účet",
    badge: "Smlouva schválena",
    hero: "Vítejte v Lunchportalen",
    greeting: (n) => `Dobrý den, ${n},`,
    intro: (c) => `Smlouva pro ${c} byla schválena a je připravena k aktivaci.`,
    activateLead: "Kliknutím na tlačítko níže si vytvořte přihlášení a začněte:",
    cta: "Aktivovat účet",
    expiryTitle: "Odkaz je platný 7 dní.",
    expiryNote: "Pokud odkaz vyprší, kontaktujte nás a pošleme vám nový.",
    signoff: "S pozdravem,\nTým Lunchportalen",
  },
  pt: {
    subject: "Bem-vindo à Lunchportalen \u2013 ative a sua conta",
    badge: "Acordo aprovado",
    hero: "Bem-vindo à Lunchportalen",
    greeting: (n) => `Olá ${n},`,
    intro: (c) => `O acordo para ${c} foi aprovado e está pronto para ser ativado.`,
    activateLead: "Clique no botão abaixo para criar o seu acesso e começar:",
    cta: "Ativar conta",
    expiryTitle: "O link é válido durante 7 dias.",
    expiryNote: "Se o link expirar, contacte-nos para receber um novo.",
    signoff: "Com os melhores cumprimentos,\nA equipa Lunchportalen",
  },
  el: {
    subject: "Καλώς ήρθατε στο Lunchportalen \u2013 ενεργοποιήστε τον λογαριασμό σας",
    badge: "Η συμφωνία εγκρίθηκε",
    hero: "Καλώς ήρθατε στο Lunchportalen",
    greeting: (n) => `Γεια σας ${n},`,
    intro: (c) => `Η συμφωνία για την ${c} έχει εγκριθεί και είναι έτοιμη για ενεργοποίηση.`,
    activateLead: "Κάντε κλικ στο παρακάτω κουμπί για να δημιουργήσετε τα στοιχεία σύνδεσής σας και να ξεκινήσετε:",
    cta: "Ενεργοποίηση λογαριασμού",
    expiryTitle: "Ο σύνδεσμος ισχύει για 7 ημέρες.",
    expiryNote: "Αν ο σύνδεσμος λήξει, επικοινωνήστε μαζί μας για έναν νέο.",
    signoff: "Με εκτίμηση,\nΗ ομάδα του Lunchportalen",
  },
};

export function companyApprovedCopy(locale: AppLocale | string | null | undefined): CompanyApprovedCopy {
  const raw = String(locale ?? "").trim();
  const key = raw as AppLocale;
  // 15/15 komplett; ukjent/tom locale faller lukket tilbake til nb.
  return COMPANY_APPROVED_COPY[key] ?? COMPANY_APPROVED_NB;
}
