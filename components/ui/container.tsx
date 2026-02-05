import * as React from "react";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("lp-container", className)} {...props} />;
});
