"use client";

/**
 * Globale CMS-workspace-animasjoner (fade-in, block-pulse). Ren presentasjon — ingen domene.
 */

export function ContentWorkspaceShellGlobalStyles() {
  return (
    <style jsx global>{`
      .animate-fade-in {
        animation: fadeIn 0.22s ease-out;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-block-pulse {
        animation: blockPulse 0.7s ease-out 1;
      }
      @keyframes blockPulse {
        0% {
          box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.4);
        }
        60% {
          box-shadow: 0 0 0 10px rgba(236, 72, 153, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(236, 72, 153, 0);
        }
      }
    `}</style>
  );
}
