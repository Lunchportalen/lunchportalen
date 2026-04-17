import { describe, it, expect } from "vitest";
import { operationalStatusStripPresentation } from "@/lib/superadmin/operationalStatusStripPresentation";

describe("operationalStatusStripPresentation", () => {
  it("mapper alle canonical nivåer til klar / avvik / blokkert / nøytral / feil", () => {
    expect(operationalStatusStripPresentation("READY").variant).toBe("ok");
    expect(operationalStatusStripPresentation("READY_WITH_WARNINGS").variant).toBe("warn");
    expect(operationalStatusStripPresentation("BLOCKED_GLOBAL_CLOSED").variant).toBe("blocked");
    expect(operationalStatusStripPresentation("NOT_DELIVERY_DAY").variant).toBe("neutral");
    expect(operationalStatusStripPresentation("ERROR").variant).toBe("error");
  });
});
