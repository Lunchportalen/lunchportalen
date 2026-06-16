import GlobalControlTowerClient from "./GlobalControlTowerClient";
import {
  SuperadminContextNote,
  SuperadminHero,
  SuperadminPageShell,
  SuperadminSection,
} from "@/components/superadmin/shell/SuperadminShell";

export default function GlobalControlTowerPage() {
  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Global"
        lead="Global styring og markedsorkestrering — estimerte signaler isoleres per marked."
      />

      <SuperadminContextNote>
        Flere markeder og agenter orkestreres deterministisk. Data isoleres per markeds-ID. Ett marked feiler ikke for
        andre. Tall merket estimated er ikke regnskapsfasit.
      </SuperadminContextNote>

      <SuperadminSection title="Global kontroll" lead="Markeder, revenue-autopilot og orkestrering." flat>
        <GlobalControlTowerClient />
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
