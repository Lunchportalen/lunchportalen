import { describe, expect, test } from "vitest";

import { classifyHookType, scoreHookStrength, selectBestHook } from "@/lib/video/psychology";

describe("psychology", () => {
  test("classifyHookType — deterministiske nøkkelord", () => {
    expect(classifyHookType("Dette er ikke vanlig …")).toBe("pattern_interrupt");
    expect(classifyHookType("De fleste gjør feil her.")).toBe("mistake");
    expect(classifyHookType("Se hva som skjer")).toBe("curiosity");
    expect(classifyHookType("Du kommer til å bli overrasket")).toBe("shock");
    expect(classifyHookType("Rolig produktverdi.")).toBe("neutral");
  });

  test("scoreHookStrength", () => {
    expect(scoreHookStrength("kort")).toBe(10);
    expect(scoreHookStrength("kort!")).toBe(15);
    expect(scoreHookStrength("vent...")).toBe(20);
  });

  test("selectBestHook — rangerer deterministisk", () => {
    const hooks = ["Rolig linje uten signal.", "Se hva som skjer når du prøver.", "Feil mange gjør."];
    const { selectedHook, ranked } = selectBestHook(hooks, {});
    expect(ranked.length).toBe(3);
    expect(hooks).toContain(selectedHook);
  });
});
