import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: "default" | "soft";
  padded?: boolean;
  children: ReactNode;
}

export function Card({
  surface = "default",
  padded = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const bg =
    surface === "soft"
      ? "bg-[var(--mf-surface-soft)]"
      : "bg-[var(--mf-surface)]";

  return (
    <div
      className={`rounded-[var(--mf-radius-md)] border border-[var(--mf-line)] shadow-[var(--mf-shadow-1)] ${bg} ${padded ? "p-5" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = "",
}: CardHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mf-line)] px-5 py-3.5 ${className}`.trim()}
    >
      <div className="min-w-0">
        <h3 className="m-0 text-[14px] font-bold tracking-[-0.015em] text-[var(--mf-ink)]">
          {title}
        </h3>
        {subtitle && (
          <p className="m-0 mt-0.5 text-[12px] text-[var(--mf-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`.trim()}>{children}</div>;
}
