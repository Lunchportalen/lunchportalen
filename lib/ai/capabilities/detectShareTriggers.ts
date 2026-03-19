/**
 * AI virality signal detector capability: detectShareTriggers.
 * Detects share triggers in content: emotion, utility, identity, exclusivity, curiosity, social proof.
 * Returns which triggers are present, strength, and suggestions to strengthen shareability. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectShareTriggers";

const detectShareTriggersCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects virality and share triggers in content: emotion, utility (tips/lists), identity (you/status), exclusivity, curiosity (questions), social proof. Returns presence, strength, and suggestions to strengthen shareability.",
  requiredContext: ["content"],
  inputSchema: {
    type: "object",
    description: "Share trigger detection input",
    properties: {
      content: { type: "string", description: "Content to analyze (e.g. copy, headline, body text)" },
      context: { type: "string", description: "Optional: landing page, blog, email, etc." },
      locale: { type: "string", description: "Locale (nb | en) for labels and suggestions" },
    },
    required: ["content"],
  },
  outputSchema: {
    type: "object",
    description: "Detected share triggers",
    required: ["triggers", "summary"],
    properties: {
      triggers: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "label", "present", "strength", "suggestion"],
          properties: {
            type: { type: "string" },
            label: { type: "string" },
            present: { type: "boolean" },
            strength: { type: "string", description: "strong | weak | absent" },
            suggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection and suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectShareTriggersCapability);

export type DetectShareTriggersInput = {
  content: string;
  context?: string | null;
  locale?: "nb" | "en" | null;
};

export type ShareTriggerStrength = "strong" | "weak" | "absent";

export type ShareTriggerResult = {
  type: string;
  label: string;
  present: boolean;
  strength: ShareTriggerStrength;
  suggestion: string;
};

export type DetectShareTriggersOutput = {
  triggers: ShareTriggerResult[];
  summary: string;
};

type TriggerDef = {
  type: string;
  labelEn: string;
  labelNb: string;
  patterns: RegExp[];
  strongThreshold: number;
  suggestionEn: string;
  suggestionNb: string;
};

const TRIGGER_DEFS: TriggerDef[] = [
  {
    type: "emotion",
    labelEn: "Emotion",
    labelNb: "Følelse",
    patterns: [
      /\b(amazing|incredible|love|excited|proud|happy|inspired|surprised|wow|fantastic)\b/i,
      /\b(fantastisk|utrolig|elsker|spent|stolt|inspirert|overrasket|wow)\b/i,
    ],
    strongThreshold: 2,
    suggestionEn: "Add one or two emotional words (e.g. surprising, inspiring) to increase share appeal.",
    suggestionNb: "Legg til ett eller to følelsesord (f.eks. overraskende, inspirerende) for økt delingsverdi.",
  },
  {
    type: "utility",
    labelEn: "Utility (tips, lists, numbers)",
    labelNb: "Nytte (tips, lister, tall)",
    patterns: [
      /\b(\d+)\s*(tips?|ways?|steps?|reasons?|ideas?|things?)\b/i,
      /\b(\d+)\s*(tips?|måter?|steg|grunner?|ideer?|ting)\b/i,
      /\b(how to|guide|checklist|step by step)\b/i,
      /\b(slik|veiledning|sjekkliste|steg for steg)\b/i,
    ],
    strongThreshold: 2,
    suggestionEn: "Include a number + benefit (e.g. 5 tips to…) or a clear how-to; list content gets shared.",
    suggestionNb: "Inkluder tall + fordel (f.eks. 5 tips for…) eller tydelig slik-gjør-du; listeinnhold deles.",
  },
  {
    type: "identity",
    labelEn: "Identity (you, status, belonging)",
    labelNb: "Identitet (du, status, tilhørighet)",
    patterns: [
      /\b(you|your|yours|we|our|together|belong|community)\b/i,
      /\b(du|din|ditt|vi|vår|sammen|tilhør|fellesskap)\b/i,
    ],
    strongThreshold: 3,
    suggestionEn: "Use 'you' or 'your' to make it personal; hint at status or belonging to boost sharing.",
    suggestionNb: "Bruk «du» eller «din» for å gjøre det personlig; antyd status eller tilhørighet for mer deling.",
  },
  {
    type: "exclusivity",
    labelEn: "Exclusivity (only, first, limited)",
    labelNb: "Eksklusivitet (kun, først, begrenset)",
    patterns: [
      /\b(only|first|exclusive|limited|early access|insider|secret)\b/i,
      /\b(kun|først|eksklusiv|begrenset|tidlig tilgang|insider|hemmelighet)\b/i,
    ],
    strongThreshold: 1,
    suggestionEn: "Add a light exclusivity cue (e.g. first to know, limited) to encourage sharing.",
    suggestionNb: "Legg til diskret eksklusivitetsignal (f.eks. først med å vite, begrenset) for å oppmuntre deling.",
  },
  {
    type: "curiosity",
    labelEn: "Curiosity (question, teaser)",
    labelNb: "Nysgjerrighet (spørsmål, teaser)",
    patterns: [
      /\?/,
      /\b(discover|find out|learn why|see how|what (if|happens))\b/i,
      /\b(oppdag|finn ut|lær hvorfor|se hvordan|hva (om|skjer))\b/i,
    ],
    strongThreshold: 2,
    suggestionEn: "Pose a question or tease an outcome to spark curiosity and shares.",
    suggestionNb: "Still et spørsmål eller antyd et utfall for å vekke nysgjerrighet og deling.",
  },
  {
    type: "social_proof",
    labelEn: "Social proof (testimonial, numbers)",
    labelNb: "Sosialt bevis (anmeldelse, tall)",
    patterns: [
      /\b(\d+[kKmM]?\s*(users?|customers?|people|followers?))\b/i,
      /\b(\d+[kKmM]?\s*(brukere?|kunder?|personer|følgere?))\b/i,
      /\b(review|testimonial|rating|trusted|recommended)\b/i,
      /\b(anmeldelse|tilbakemelding|vurdert|betrodd|anbefalt)\b/i,
    ],
    strongThreshold: 2,
    suggestionEn: "Add a concrete number (e.g. 10k users) or a short testimonial to boost share confidence.",
    suggestionNb: "Legg til et konkret tall (f.eks. 10k brukere) eller kort anmeldelse for å styrke delingsvilje.",
  },
];

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) n += matches.length;
  }
  return n;
}

/**
 * Detects share triggers in content. Deterministic; no external calls.
 */
export function detectShareTriggers(input: DetectShareTriggersInput): DetectShareTriggersOutput {
  const content = (input.content ?? "").trim();
  const isEn = input.locale === "en";

  const triggers: ShareTriggerResult[] = TRIGGER_DEFS.map((def) => {
    const count = countMatches(content, def.patterns);
    const present = count > 0;
    const strength: ShareTriggerStrength =
      count >= def.strongThreshold ? "strong" : count > 0 ? "weak" : "absent";
    return {
      type: def.type,
      label: isEn ? def.labelEn : def.labelNb,
      present,
      strength,
      suggestion: isEn ? def.suggestionEn : def.suggestionNb,
    };
  });

  const presentCount = triggers.filter((t) => t.present).length;
  const strongCount = triggers.filter((t) => t.strength === "strong").length;
  const summary =
    content.length === 0
      ? isEn
        ? "No content provided; add text to detect share triggers."
        : "Ingen innhold oppgitt; legg til tekst for å oppdage delingstriggere."
      : isEn
        ? `Detected ${presentCount} trigger type(s) present, ${strongCount} strong. ${triggers.filter((t) => t.strength === "absent").length} absent — see suggestions.`
        : `Fant ${presentCount} triggertype(r) til stede, ${strongCount} sterke. ${triggers.filter((t) => t.strength === "absent").length} mangler — se anbefalinger.`;

  return {
    triggers,
    summary,
  };
}

export { detectShareTriggersCapability, CAPABILITY_NAME };
