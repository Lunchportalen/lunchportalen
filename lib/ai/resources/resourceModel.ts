export type Resource = {
  id: string;
  type: "AI";
  capacity: number;
  skills: string[];
};

/** Deterministic catalog — abstract capacity units (not currency). */
export function getAvailableResources(): Resource[] {
  return [
    {
      id: "ai_marketing",
      type: "AI",
      capacity: 100,
      skills: ["ads", "seo", "content"],
    },
    {
      id: "ai_cro",
      type: "AI",
      capacity: 100,
      skills: ["conversion", "ab_testing"],
    },
    {
      id: "ai_ops",
      type: "AI",
      capacity: 100,
      skills: ["automation", "execution"],
    },
  ];
}

export function totalResourceCapacity(resources: Resource[]): number {
  return resources.reduce((s, r) => s + Math.max(0, r.capacity), 0);
}
