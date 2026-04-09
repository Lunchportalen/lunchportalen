/**
 * Deterministisk innvendingsklassifisering (ingen LLM).
 */
export type ObjectionType = "existing_solution" | "price" | "timing" | "uncertain" | "unknown";

export function detectObjection(text: string): ObjectionType {
  const t = String(text ?? "").toLowerCase();

  if (t.includes("har allerede") || t.includes("egen løsning")) {
    return "existing_solution";
  }

  if (t.includes("dyrt") || t.includes("for dyrt") || t.includes("pris")) {
    return "price";
  }

  if (t.includes("ikke nå") || t.includes("senere")) {
    return "timing";
  }

  if (t.includes("usikker") || t.includes("vet ikke")) {
    return "uncertain";
  }

  return "unknown";
}
