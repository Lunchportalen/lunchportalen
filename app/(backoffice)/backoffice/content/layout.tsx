import type { ReactNode } from "react";
import { ContentBellissimaWorkspaceProvider } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { BlockEditorDataTypesMergedProvider } from "./_components/BlockEditorDataTypesMergedContext";
import { DocumentTypeDefinitionsMergedProvider } from "./_components/DocumentTypeDefinitionsMergedContext";
import { ElementTypeRuntimeMergedProvider } from "./_components/ElementTypeRuntimeMergedContext";
import ContentWorkspaceHost from "./_workspace/ContentWorkspaceHost";

export default function ContentSectionLayout({ children }: { children: ReactNode }) {
  return (
    <ContentBellissimaWorkspaceProvider>
      <BlockEditorDataTypesMergedProvider>
        <DocumentTypeDefinitionsMergedProvider>
          <ElementTypeRuntimeMergedProvider>
            <ContentWorkspaceHost>{children}</ContentWorkspaceHost>
          </ElementTypeRuntimeMergedProvider>
        </DocumentTypeDefinitionsMergedProvider>
      </BlockEditorDataTypesMergedProvider>
    </ContentBellissimaWorkspaceProvider>
  );
}
