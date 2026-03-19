import type { ReactNode } from "react";
import ContentWorkspace from "./_workspace/ContentWorkspace";
import { MainViewProvider } from "./_workspace/MainViewContext";

export default function ContentSectionLayout({ children }: { children: ReactNode }) {
  return (
    <MainViewProvider>
      <ContentWorkspace>{children}</ContentWorkspace>
    </MainViewProvider>
  );
}
