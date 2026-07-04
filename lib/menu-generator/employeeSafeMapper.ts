import type {
  EmployeeSafeMenuChoice,
  GeneratedMenuChoiceInternal,
  GeneratedProviderWeekMenu,
} from "@/lib/menu-generator/types";

const EMPLOYEE_FORBIDDEN_KEYS = [
  "price",
  "currency",
  "default_currency",
  "vat",
  "VAT",
  "mva",
  "MVA",
  "commission",
  "provision",
  "invoice",
  "margin",
  "cost",
  "providerCost",
  "packagePrice",
  "billing",
  "economy",
  "slug",
  "tags",
  "hotMealBaseItemKey",
  "isPremiumUpgrade",
] as const;

function toEmployeeChoice(choice: GeneratedMenuChoiceInternal): EmployeeSafeMenuChoice {
  return {
    dayIndex: choice.dayIndex,
    date: choice.date,
    categoryKey: choice.categoryKey,
    tier: choice.tier,
    itemKey: choice.itemKey,
    choiceKey: choice.choiceKey,
    title: choice.title,
    description: choice.description,
    allergens: choice.allergens,
  };
}

export type EmployeeSafeWeekMenu = {
  providerId: string;
  weekStart: string;
  menuLocale: string;
  packageTier: string;
  days: readonly {
    dayIndex: number;
    date: string;
    choices: readonly EmployeeSafeMenuChoice[];
  }[];
};

export function mapGeneratedWeekMenuToEmployeeSafe(
  menu: GeneratedProviderWeekMenu,
): EmployeeSafeWeekMenu {
  return {
    providerId: menu.providerId,
    weekStart: menu.weekStart,
    menuLocale: menu.menuLocale,
    packageTier: menu.packageTier,
    days: menu.days.map((day) => ({
      dayIndex: day.dayIndex,
      date: day.date,
      choices: day.choices.map(toEmployeeChoice),
    })),
  };
}

export function assertEmployeeSafePayload(payload: unknown): void {
  const json = JSON.stringify(payload);
  for (const key of EMPLOYEE_FORBIDDEN_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`Employee-safe payload leaked forbidden field: ${key}`);
    }
  }
}

export { EMPLOYEE_FORBIDDEN_KEYS };
