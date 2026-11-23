import type { ReactNode } from "react";
export { AppFooter } from "./AppFooter";

export type ContainerWidth = "narrow" | "standard" | "wide";

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  narrow: "max-w-[680px]",
  standard: "max-w-[1160px]",
  wide: "max-w-[1360px]",
};

export interface PageContainerProps {
  width?: ContainerWidth;
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  width = "standard",
  children,
  className = "",
}: PageContainerProps) {
  return (
    <main
      className={`mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 ${WIDTH_CLASSES[width]} ${className}`.trim()}
    >
      {children}
    </main>
  );
}
