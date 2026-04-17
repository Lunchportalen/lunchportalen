import type { ReactNode } from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const MAX: Record<"narrow" | "content" | "wide", string> = {
  narrow: "max-w-3xl",
  content: "max-w-5xl",
  wide: "max-w-7xl",
};

export type PageContainerProps = {
  children: ReactNode;
  className?: string;
  /** Default horizontal padding + centered max width. */
  maxWidth?: keyof typeof MAX;
};

export function PageContainer({ children, className, maxWidth = "wide" }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", MAX[maxWidth], className)}>{children}</div>
  );
}
