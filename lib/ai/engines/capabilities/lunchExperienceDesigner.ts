/**
 * AI Lunch Experience Designer capability: suggestLunchExperiences.
 * AI foreslår temamenyer og spesialdager for å øke trivsel.
 * Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "lunchExperienceDesigner";

const lunchExperienceDesignerCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Lunch experience designer: suggests theme menus and special days to increase well-being (trivsel). Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Lunch experience designer input",
    properties: {
      season: {
        type: "string",
        enum: ["vår", "sommer", "høst", "vinter"],
        description: "Sesong for forslag",
      },
      locale: { type: "string", enum: ["nb", "en"] },
      numberOfWeeks: { type: "number", description: "Optional; how many weeks to suggest for" },
    },
    required: ["season"],
  },
  outputSchema: {
    type: "object",
    description: "Lunch experience suggestions",
    required: ["themeDays", "seasonMenus", "internationalWeeks", "summary", "generatedAt"],
    properties: {
      themeDays: { type: "array", items: { type: "object" } },
      seasonMenus: { type: "array", items: { type: "object" } },
      internationalWeeks: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is experience suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(lunchExperienceDesignerCapability);

export type Season = "vår" | "sommer" | "høst" | "vinter";

export type LunchExperienceDesignerInput = {
  season: Season;
  locale?: "nb" | "en" | null;
  numberOfWeeks?: number | null;
};

export type ThemeDaySuggestion = {
  title: string;
  description: string;
  exampleDishes: string[];
  rationale: string;
  suggestedWeekday?: string | null;
};

export type SeasonMenuSuggestion = {
  title: string;
  description: string;
  dishHints: string[];
  rationale: string;
};

export type InternationalWeekSuggestion = {
  title: string;
  description: string;
  cuisine: string;
  dishHints: string[];
  rationale: string;
};

export type LunchExperienceDesignerOutput = {
  themeDays: ThemeDaySuggestion[];
  seasonMenus: SeasonMenuSuggestion[];
  internationalWeeks: InternationalWeekSuggestion[];
  summary: string;
  generatedAt: string;
};

/**
 * Suggests theme days, season menus, and international weeks for a more social lunch. Deterministic.
 */
export function suggestLunchExperiences(
  input: LunchExperienceDesignerInput
): LunchExperienceDesignerOutput {
  const isEn = input.locale === "en";
  const season = input.season;

  const themeDays: ThemeDaySuggestion[] = [];
  const seasonMenus: SeasonMenuSuggestion[] = [];
  const internationalWeeks: InternationalWeekSuggestion[] = [];

  if (season === "vår") {
    themeDays.push(
      isEn
        ? {
            title: "Soup Monday",
            description: "Start the week with warming soups and fresh bread.",
            exampleDishes: ["Vegetable soup", "Fish soup", "Lentil soup"],
            rationale: "Shared soup creates a calm, social start to the week.",
            suggestedWeekday: "Monday",
          }
        : {
            title: "Suppemandag",
            description: "Start uken med varm suppe og friskt brød.",
            exampleDishes: ["Grønnsakssuppe", "Fiskesuppe", "Linsesuppe"],
            rationale: "Felles suppe skaper en rolig, sosial start på uken.",
            suggestedWeekday: "Mandag",
          }
    );
    themeDays.push(
      isEn
        ? {
            title: "Green Wednesday",
            description: "Focus on green vegetables and seasonal greens.",
            exampleDishes: ["Spring salad", "Asparagus dish", "Pea soup"],
            rationale: "Seasonal greens give a common theme to talk about.",
            suggestedWeekday: "Wednesday",
          }
        : {
            title: "Grønn onsdag",
            description: "Fokus på grønnsaker og sesongens grønne.",
            exampleDishes: ["Vårsalat", "Aspargesrett", "Ertesuppe"],
            rationale: "Sesongens grønnsaker gir et felles tema å snakke om.",
            suggestedWeekday: "Onsdag",
          }
    );
    seasonMenus.push(
      isEn
        ? {
            title: "Spring harvest menu",
            description: "Dishes based on early spring produce.",
            dishHints: ["Rhubarb", "Asparagus", "New potatoes", "Spring herbs"],
            rationale: "Seasonal menus create anticipation and shared experience.",
          }
        : {
            title: "Vårhaust-meny",
            description: "Retter basert på tidlig vårproduksjon.",
            dishHints: ["Rabarber", "Asparges", "Nypoteter", "Vårurter"],
            rationale: "Sesongmenyer skaper forventning og felles opplevelse.",
          }
    );
    internationalWeeks.push(
      isEn
        ? {
            title: "Italian week",
            description: "A week of Italian-inspired lunches.",
            cuisine: "Italian",
            dishHints: ["Pasta", "Risotto", "Minestrone", "Pizza-style flatbread"],
            rationale: "International weeks spark conversation and variety.",
          }
        : {
            title: "Italiensk uke",
            description: "En uke med italiensk-inspirert lunsj.",
            cuisine: "Italiensk",
            dishHints: ["Pasta", "Risotto", "Minestrone", "Pizza-inspirert flatbrød"],
            rationale: "Internasjonale uker skaper samtale og variasjon.",
          }
    );
  }

  if (season === "sommer") {
    themeDays.push(
      isEn
        ? {
            title: "Salad Tuesday",
            description: "Light salads and cold dishes for warm days.",
            exampleDishes: ["Greek salad", "Noodle salad", "Caprese"],
            rationale: "Shared light lunch fits summer and encourages gathering.",
            suggestedWeekday: "Tuesday",
          }
        : {
            title: "Salattirsdag",
            description: "Lette salater og kalde retter for varme dager.",
            exampleDishes: ["Gresk salat", "Nudelsalat", "Caprese"],
            rationale: "Felles lett lunsj passer sommeren og oppfordrer til samvær.",
            suggestedWeekday: "Tirsdag",
          }
    );
    themeDays.push(
      isEn
        ? {
            title: "BBQ Friday",
            description: "Grill-inspired dishes and summer flavours.",
            exampleDishes: ["Grilled chicken salad", "Kebabs", "Coleslaw"],
            rationale: "Friday theme builds anticipation for the weekend together.",
            suggestedWeekday: "Friday",
          }
        : {
            title: "Grillfredag",
            description: "Grillinspirerte retter og sommersmaker.",
            exampleDishes: ["Grillkyllingsalat", "Kebab", "Coleslaw"],
            rationale: "Fredagstema skaper forventning for helgen sammen.",
            suggestedWeekday: "Fredag",
          }
    );
    seasonMenus.push(
      isEn
        ? {
            title: "Summer light menu",
            description: "Fresh, cold and semi-cold options.",
            dishHints: ["Berries", "Cucumber", "Tomato", "Fresh herbs", "Cold fish"],
            rationale: "Seasonal summer menus support social, relaxed lunches.",
          }
        : {
            title: "Sommerlett meny",
            description: "Ferske, kalde og halvkalde alternativer.",
            dishHints: ["Bær", "Agurk", "Tomat", "Ferske urter", "Kald fisk"],
            rationale: "Sesongmenyer for sommer støtter sosial, avslappet lunsj.",
          }
    );
    internationalWeeks.push(
      isEn
        ? {
            title: "Mediterranean week",
            description: "Mediterranean flavours for a week.",
            cuisine: "Mediterranean",
            dishHints: ["Tzatziki", "Hummus", "Falafel", "Grilled vegetables", "Feta salad"],
            rationale: "Shared cuisine theme strengthens team connection.",
          }
        : {
            title: "Middelhavsuke",
            description: "Middelhavssmaker en uke.",
            cuisine: "Middelhavskjøkken",
            dishHints: ["Tzatziki", "Hummus", "Falafel", "Grillede grønnsaker", "Fetasalat"],
            rationale: "Felles kjøkkenstema styrker teamfølelsen.",
          }
    );
  }

  if (season === "høst") {
    themeDays.push(
      isEn
        ? {
            title: "Comfort Thursday",
            description: "Warming, comforting dishes as days get shorter.",
            exampleDishes: ["Casserole", "Stew", "Shepherd's pie"],
            rationale: "Comfort food encourages cosy, social lunches.",
            suggestedWeekday: "Thursday",
          }
        : {
            title: "Koselunsj torsdag",
            description: "Varmende, trøstende retter når dagene blir mørkere.",
            exampleDishes: ["Gryterett", "Lapskaus", "Shepherd's pie"],
            rationale: "Koserett oppfordrer til hyggelig, sosial lunsj.",
            suggestedWeekday: "Torsdag",
          }
    );
    themeDays.push(
      isEn
        ? {
            title: "Root vegetable day",
            description: "Focus on carrots, celeriac, beetroot and squash.",
            exampleDishes: ["Root vegetable soup", "Roasted vegetables", "Beetroot salad"],
            rationale: "Autumn produce gives a clear, talkable theme.",
            suggestedWeekday: "Wednesday",
          }
        : {
            title: "Rotgrønnsaksdag",
            description: "Fokus på gulrot, selleri, rødbeter og gresskar.",
            exampleDishes: ["Rotgrønnsakssuppe", "Bakte grønnsaker", "Rødbetsalat"],
            rationale: "Høstens grønnsaker gir et tydelig, snakkbart tema.",
            suggestedWeekday: "Onsdag",
          }
    );
    seasonMenus.push(
      isEn
        ? {
            title: "Autumn harvest menu",
            description: "Dishes based on autumn produce.",
            dishHints: ["Pumpkin", "Apple", "Mushrooms", "Cabbage", "Game"],
            rationale: "Seasonal menus create shared anticipation.",
          }
        : {
            title: "Høsthaust-meny",
            description: "Retter basert på høstens råvarer.",
            dishHints: ["Gresskar", "Eple", "Sopp", "Kål", "Vilt"],
            rationale: "Sesongmenyer skaper felles forventning.",
          }
    );
    internationalWeeks.push(
      isEn
        ? {
            title: "Nordic week",
            description: "A week of Nordic and Scandinavian dishes.",
            cuisine: "Nordic",
            dishHints: ["Gravlaks", "Meatballs", "Pickled herring", "Rye bread", "Lingonberry"],
            rationale: "Nordic theme fits autumn and supports local identity.",
          }
        : {
            title: "Nordisk uke",
            description: "En uke med nordiske og skandinaviske retter.",
            cuisine: "Nordisk",
            dishHints: ["Gravlaks", "Kjøttboller", "Sild", "Rugbrød", "Tyttebær"],
            rationale: "Nordisk tema passer høsten og støtter lokal identitet.",
          }
    );
  }

  if (season === "vinter") {
    themeDays.push(
      isEn
        ? {
            title: "Soup & bread day",
            description: "Warming soups and hearty bread every week.",
            exampleDishes: ["Pea soup", "Beef soup", "Fish soup", "Rye bread"],
            rationale: "Recurring soup day becomes a social ritual.",
            suggestedWeekday: "Wednesday",
          }
        : {
            title: "Suppe- og brøddag",
            description: "Varm suppe og godt brød hver uke.",
            exampleDishes: ["Ertesuppe", "Oksebuljong", "Fiskesuppe", "Rugbrød"],
            rationale: "Gjentakende suppedag blir en sosial ritual.",
            suggestedWeekday: "Onsdag",
          }
    );
    themeDays.push(
      isEn
        ? {
            title: "Friday treat",
            description: "Slightly more festive end-of-week lunch.",
            exampleDishes: ["Tacos", "Burger day", "Waffles with fixings"],
            rationale: "Weekly treat strengthens team spirit.",
            suggestedWeekday: "Friday",
          }
        : {
            title: "Fredagsgodt",
            description: "Litt mer festlig fredagslunsj.",
            exampleDishes: ["Tacos", "Burgerdag", "Vafler med pålegg"],
            rationale: "Ukentlig godbit styrker teamånden.",
            suggestedWeekday: "Fredag",
          }
    );
    seasonMenus.push(
      isEn
        ? {
            title: "Winter warming menu",
            description: "Filling, warming dishes for cold days.",
            dishHints: ["Casseroles", "Stews", "Root vegetables", "Cabbage", "Dried fruit"],
            rationale: "Winter menus support cosy, social lunch breaks.",
          }
        : {
            title: "Vintervarm meny",
            description: "Mettende, varmende retter for kalde dager.",
            dishHints: ["Gryter", "Lapskaus", "Rotgrønnsaker", "Kål", "Tørket frukt"],
            rationale: "Vintermenyer støtter hyggelig, sosial lunsjpause.",
          }
    );
    internationalWeeks.push(
      isEn
        ? {
            title: "Asian week",
            description: "A week of Asian-inspired dishes.",
            cuisine: "Asian",
            dishHints: ["Curry", "Stir-fry", "Ramen-style soup", "Dumplings", "Rice dishes"],
            rationale: "International weeks add variety and conversation in winter.",
          }
        : {
            title: "Asiatisk uke",
            description: "En uke med asiatisk-inspirert mat.",
            cuisine: "Asiatisk",
            dishHints: ["Karri", "Wok", "Ramen-inspirert suppe", "Dumplings", "Risretter"],
            rationale: "Internasjonale uker gir variasjon og samtale om vinteren.",
          }
    );
  }

  const summary = isEn
    ? `${themeDays.length} theme days, ${seasonMenus.length} season menu(s), ${internationalWeeks.length} international week(s) for ${season}. Use to make lunch more social.`
    : `${themeDays.length} temadager, ${seasonMenus.length} sesongmeny(er), ${internationalWeeks.length} internasjonal(e) uke(r) for ${season}. Bruk for å gjøre lunsj mer sosial.`;

  return {
    themeDays,
    seasonMenus,
    internationalWeeks,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
