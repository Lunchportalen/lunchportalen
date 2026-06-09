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

export type StartCopy = {
  meta: {
    title: string;
    description: string;
  };
  brand: {
    name: string;
  };
  gate: {
    headline: string;
    lead: string;
    trustPoints: readonly [string, string, string];
    roleGroupLabel: string;
    trustListLabel: string;
  };
  paths: {
    business: StartPathCopy;
    caterer: StartPathCopy;
  };
  geography: {
    title: string;
    lead: string;
    back: string;
  };
  loading: string;
};

const NO: StartCopy = {
  meta: {
    title: "Kom i gang",
    description:
      "Velg om du er bedrift som ønsker firmalunsj, eller caterer som vil bli leverandør i Lunchportalen.",
  },
  brand: {
    name: "Lunchportalen",
  },
  gate: {
    headline: "Velg hvordan du vil bruke Lunchportalen",
    lead: "Finn firmalunsj til bedriften – eller bli leverandør på plattformen. Vi hjelper deg videre med riktig flyt.",
    trustPoints: ["Ingen forpliktelser", "Riktig flyt fra start", "For bedrifter og caterere"],
    roleGroupLabel: "Velg din rolle",
    trustListLabel: "Dette kan du forvente",
  },
  paths: {
    business: {
      title: "For bedrifter",
      subtitle: "Jeg ønsker lunsj til bedriften",
      text: "Finn caterere som leverer til deres område. Ansatte bestiller selv, og bedriften får bedre kontroll på lunsjflyten.",
      cta: "Finn caterere nær oss",
    },
    caterer: {
      title: "For caterere",
      subtitle: "Jeg er caterer",
      text: "Bli leverandør på Lunchportalen og få en strukturert flyt for avtaler, bestillinger, cutoff og produksjonsgrunnlag.",
      cta: "Meld interesse som caterer",
    },
  },
  geography: {
    title: "Hvor holder bedriften til?",
    lead: "Fortell oss hvor dere er, så finner vi caterere som leverer lunsj til dere.",
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
    headline: "Choose how you want to use Lunchportalen",
    lead: "Find corporate lunch for your company — or become a supplier on the platform. We guide you to the right flow.",
    trustPoints: ["No commitment", "The right flow from day one", "For companies and caterers"],
    roleGroupLabel: "Choose your role",
    trustListLabel: "What to expect",
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
    title: "Where is your company located?",
    lead: "Tell us where you are, and we will find caterers that deliver lunch to you.",
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
