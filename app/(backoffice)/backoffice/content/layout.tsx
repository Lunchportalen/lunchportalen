import type { ReactNode } from "react";
import ContentWorkspace from "./_workspace/ContentWorkspace";

export default function ContentSectionLayout({ children }: { children: ReactNode }) {
  return <ContentWorkspace>{children}</ContentWorkspace>;
}
