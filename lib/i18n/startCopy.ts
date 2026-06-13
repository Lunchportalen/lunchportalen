/**
 * /start — locale-ready UI copy (no external i18n dependency).
 *
 * Locale-ready now:
 * - All role-gate, geography header, and back-link strings for /start live here.
 * - `getStartCopy(locale)` resolves copy with fallback chain: locale → en → no.
 *
 * Not wired yet (future work):
 * - URL/cookie/header locale resolver on app shell
 * - Database market → locale mapping
 * - Language picker UI
 * - GeographyGateForm / ProviderIntakeForm field labels (separate copy modules)
 * - Next.js metadata per locale / hreflang
 */

export const SUPPORTED_START_LOCALES = ["no", "en", "da", "fi", "de", "fr", "es"] as const;

export type StartLocale = (typeof SUPPORTED_START_LOCALES)[number];

export const DEFAULT_START_LOCALE: StartLocale = "no";

export type StartPathCopy = {
  title: string;
  subtitle: string;
  text: string;
  cta: string;
};

export type StartProviderCopy = {
  title: string;
  lead: string;
  /** Calm reassurance line under the lead (not a form footer). */
  reassurance: string;
  fields: {
    name: string;
    email: string;
    phone: string;
    company: string;
    postalCode: string;
    postalCodeHint: string;
    city: string;
    message: string;
  };
  consent: string;
  cta: string;
  ctaLoading: string;
  consentError: string;
  errorGeneric: string;
  successTitle: string;
  successText: string;
  loginPrompt: string;
  loginLinkLabel: string;
  back: string;
};

export type StartCopy = {
  meta: {
    title: string;
    description: string;
  };
  brand: {
    name: string;
  };
  gate: {
    /** Two-line headline for premium typographic rhythm (locale-ready). */
    headlineLines: readonly [string, string];
    lead: string;
    /** Discreet platform-flow rail: the one quiet signature element (not buttons, not KPI). */
    flowSteps: readonly [string, string, string];
    flowLabel: string;
    roleGroupLabel: string;
  };
  paths: {
    business: StartPathCopy;
    caterer: StartPathCopy;
  };
  geography: {
    title: string;
    lead: string;
    /** Calm reassurance line under the lead. */
    reassurance: string;
    /** Matching-process hint: Location → Coverage → Supplier match. */
    matchingSteps: readonly [string, string, string];
    matchingLabel: string;
    fields: {
      postalCode: string;
      postalCodeHint: string;
      city: string;
    };
    cta: string;
    /** Calm coverage-check loading line. */
    checking: string;
    errorPostal: string;
    errorCity: string;
    errorGeneric: string;
    back: string;
    /** Positive coverage result — premium match confirmation.
        NOTE: real provider cards require provider-match data in the coverage
        response (today it only returns covered/hasServiceAreas/mvpForward). */
    covered: {
      /** "{city}" is replaced with the confirmed city. */
      title: string;
      lead: string;
      stepsLabel: string;
      steps: readonly [string, string, string];
      ctaDemo: string;
      ctaRegister: string;
      back: string;
    };
  };
  provider: StartProviderCopy;
  loading: string;
};

const NO: StartCopy = {
  meta: {
    title: "Kom i gang",
    description:
      "Velg om du er bedrift som ønsker firmalunsj, eller cateringfirma som vil bli leverandør i Lunchportalen.",
  },
  brand: {
    name: "Lunchportalen",
  },
  gate: {
    headlineLines: ["Start riktig lunsjflyt", "for bedrift og cateringfirma"],
    lead: "Finn firmalunsj til bedriften – eller bli leverandør på plattformen. Vi hjelper deg videre med riktig flyt.",
    flowSteps: ["Bedrift", "Leverandør", "Bestilling"],
    flowLabel: "Slik henger plattformen sammen",
    roleGroupLabel: "Velg din rolle",
  },
  paths: {
    business: {
      title: "For bedrifter",
      subtitle: "Jeg ønsker lunsj til bedriften",
      text: "Finn cateringfirma som leverer til deres område. Ansatte bestiller selv, og bedriften får bedre kontroll på lunsjflyten.",
      cta: "Finn leverandører nær oss",
    },
    caterer: {
      title: "For cateringfirma",
      subtitle: "Jeg er cateringfirma",
      text: "Bli leverandør på Lunchportalen og få en strukturert flyt for avtaler, bestillinger, cutoff og produksjonsgrunnlag.",
      cta: "Meld interesse som leverandør",
    },
  },
  geography: {
    title: "Hvor skal lunsjen leveres?",
    lead: "Skriv inn postnummer og sted, så sjekker vi hvilke leverandører som dekker området deres.",
    reassurance: "Ingen forpliktelser. Dette tar bare et øyeblikk.",
    matchingSteps: ["Lokasjon", "Dekning", "Leverandørvalg"],
    matchingLabel: "Slik fungerer matchingen",
    fields: {
      postalCode: "Postnummer",
      postalCodeHint: "4 siffer, f.eks. 0150",
      city: "Poststed",
    },
    cta: "Finn leverandører nær oss",
    checking: "Sjekker dekning …",
    errorPostal: "Postnummer må være 4 siffer.",
    errorCity: "Poststed må fylles ut.",
    errorGeneric: "Vi klarte ikke å sjekke dekning akkurat nå. Prøv igjen om litt.",
    back: "Tilbake til valg",
    covered: {
      title: "Vi dekker {city}",
      lead: "Neste steg er å se hvilke leverandører som passer lokasjon, antall ansatte og ønsket lunsjflyt.",
      stepsLabel: "Neste steg",
      steps: ["Lokasjon bekreftet", "Leverandørmatch", "Avtaleforespørsel"],
      ctaDemo: "Book gjennomgang",
      ctaRegister: "Registrer bedriften",
      back: "Tilbake og endre område",
    },
  },
  provider: {
    title: "Bli leverandør på Lunchportalen",
    lead: "Fortell kort om cateringfirmaet deres, så tar vi kontakt for å se om Lunchportalen passer deres område og leveransemodell.",
    reassurance: "Ingen forpliktelser. Vi bruker informasjonen kun til å vurdere leverandørinteresse.",
    fields: {
      name: "Kontaktperson",
      email: "E-post",
      phone: "Telefon",
      company: "Cateringfirma / firmanavn",
      postalCode: "Postnummer",
      postalCodeHint: "Valgfritt — der dere leverer fra",
      city: "Sted",
      message: "Melding",
    },
    consent: "Jeg samtykker til at Lunchportalen kontakter meg om leverandøravtale og onboarding.",
    cta: "Send leverandørinteresse",
    ctaLoading: "Sender …",
    consentError: "Du må samtykke for å sende inn.",
    errorGeneric: "Vi klarte ikke å sende inn akkurat nå. Prøv igjen om litt.",
    successTitle: "Interessen er registrert",
    successText: "Takk. Vi tar kontakt for å se om Lunchportalen passer deres leveranseområde og driftsmodell.",
    loginPrompt: "Allerede leverandør?",
    loginLinkLabel: "Logg inn",
    back: "Tilbake til valg",
  },
  loading: "Laster …",
};

const EN: StartCopy = {
  meta: {
    title: "Get started",
    description:
      "Choose whether you need corporate lunch for your company, or you are a caterer who wants to join Lunchportalen.",
  },
  brand: {
    name: "Lunchportalen",
  },
  gate: {
    headlineLines: ["Start the right lunch flow", "for companies and caterers"],
    lead: "Find corporate lunch for your company — or become a supplier on the platform. We guide you to the right flow.",
    flowSteps: ["Company", "Caterer", "Order"],
    flowLabel: "How the platform connects",
    roleGroupLabel: "Choose your role",
  },
  paths: {
    business: {
      title: "For companies",
      subtitle: "I need lunch for our workplace",
      text: "Find caterers that deliver to your area. Employees order themselves, and your company gets better control of the lunch flow.",
      cta: "Find caterers near us",
    },
    caterer: {
      title: "For caterers",
      subtitle: "I am a caterer",
      text: "Join Lunchportalen as a supplier and get a structured flow for agreements, orders, cut-off and production planning.",
      cta: "Register interest as caterer",
    },
  },
  geography: {
    title: "Where should lunch be delivered?",
    lead: "Enter your postal code and city, and we will check which suppliers cover your area.",
    reassurance: "No commitment. This only takes a moment.",
    matchingSteps: ["Location", "Coverage", "Supplier match"],
    matchingLabel: "How matching works",
    fields: {
      postalCode: "Postal code",
      postalCodeHint: "4 digits, e.g. 0150",
      city: "City",
    },
    cta: "Find suppliers near us",
    checking: "Checking coverage …",
    errorPostal: "Postal code must be 4 digits.",
    errorCity: "City is required.",
    errorGeneric: "We could not check coverage right now. Please try again shortly.",
    back: "Back to choices",
    covered: {
      title: "We cover {city}",
      lead: "The next step is to see which suppliers fit your location, headcount and preferred lunch flow.",
      stepsLabel: "Next steps",
      steps: ["Location confirmed", "Supplier match", "Agreement request"],
      ctaDemo: "Book a walkthrough",
      ctaRegister: "Register your company",
      back: "Go back and change area",
    },
  },
  provider: {
    title: "Become a supplier on Lunchportalen",
    lead: "Tell us briefly about your catering company, and we will get in touch to see whether Lunchportalen fits your area and delivery model.",
    reassurance: "No commitment. We only use this information to assess supplier interest.",
    fields: {
      name: "Contact person",
      email: "Email",
      phone: "Phone",
      company: "Catering company / business name",
      postalCode: "Postal code",
      postalCodeHint: "Optional — where you deliver from",
      city: "City",
      message: "Message",
    },
    consent: "I consent to Lunchportalen contacting me about a supplier agreement and onboarding.",
    cta: "Send supplier interest",
    ctaLoading: "Sending …",
    consentError: "You must consent before submitting.",
    errorGeneric: "We could not submit right now. Please try again shortly.",
    successTitle: "Your interest has been registered",
    successText: "Thank you. We will get in touch to see whether Lunchportalen fits your delivery area and operating model.",
    loginPrompt: "Already a supplier?",
    loginLinkLabel: "Log in",
    back: "Back to choices",
  },
  loading: "Loading …",
};

/** Interim EN placeholders until market-specific translations land. */
const COPY: Record<StartLocale, StartCopy> = {
  no: NO,
  en: EN,
  da: EN,
  fi: EN,
  de: EN,
  fr: EN,
  es: EN,
};

export function resolveStartLocale(input?: string | null): StartLocale {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase()
    .split("-")[0];
  if ((SUPPORTED_START_LOCALES as readonly string[]).includes(raw)) {
    return raw as StartLocale;
  }
  return DEFAULT_START_LOCALE;
}

export function getStartCopy(locale?: string | null): StartCopy {
  const resolved = resolveStartLocale(locale);
  return COPY[resolved] ?? COPY[DEFAULT_START_LOCALE];
}
