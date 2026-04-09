export type PremiumFoodPost = {
  text: string;
  tone: "premium";
  format: "short_story + authority + sensory";
};

export function generatePremiumFoodPost(product: { name?: string }): PremiumFoodPost {
  const name = typeof product.name === "string" && product.name.trim() ? product.name.trim() : "Produktet";
  return {
    text: `30 måneder. Ren perfeksjon.

${name} – modnet i spansk høyland.

Håndskåret. Silkemyk tekstur. Dyp, nøtteaktig smak.

Dette er ikke spekemat – dette er håndverk.

✨ Perfekt til ostefat, vin eller en kveld du vil gjøre litt mer ut av.`,
    tone: "premium",
    format: "short_story + authority + sensory",
  };
}
