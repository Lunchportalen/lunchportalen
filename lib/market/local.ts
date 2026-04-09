export type CityStrategy = {
  city: string;
  message: string;
  targeting: {
    radius: number;
    audience: "office";
  };
};

export function buildCityStrategy(city: string): CityStrategy {
  const c = String(city ?? "").trim() || "Oslo";
  return {
    city: c,
    message: `Lunsjløsningen for bedrifter i ${c}`,
    targeting: {
      radius: 20,
      audience: "office",
    },
  };
}

export function runCityExpansion(cities: string[]): CityStrategy[] {
  const list = Array.isArray(cities) ? cities : [];
  return list.map((city) => buildCityStrategy(city));
}
