import GrowthDashboard from "../_workspace/GrowthDashboard";
import { ContentSectionWorkspaceSurfaceShell } from "../_workspace/ContentSectionWorkspaceSurfaceShell";

/**
 * U31 — Vekst/kontrolltårn som sekundær workspace (ikke default content landing).
 */
export default function ContentGrowthPage() {
  return (
    <ContentSectionWorkspaceSurfaceShell>
      <GrowthDashboard />
    </ContentSectionWorkspaceSurfaceShell>
  );
}
