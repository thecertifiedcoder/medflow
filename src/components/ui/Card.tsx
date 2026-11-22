import type { HTMLAttributes, ReactNode } from "react";
import { SourceTag, type SignalSource } from "./Badge";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  subtle?: boolean;
  children: ReactNode;
}

export function Card({
  subtle = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`mf-card ${subtle ? "mf-card--subtle" : ""} ${className}`.trim()}
      {...props}
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
    <div className={`mf-panel__head ${className}`.trim()}>
      <div className="min-w-0">
        <h3 className="mf-panel__title m-0">{title}</h3>
        {subtitle ? (
          <p className="mf-panel__note m-0 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({
  className = "",
  children,
  ...props
}: CardBodyProps) {
  return (
    <div className={`mf-panel__body ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export interface ClinicalPanelProps extends HTMLAttributes<HTMLElement> {
  source?: SignalSource;
  sourceLabel?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  note?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Structured clinical panel with 3px provenance top rule (.mf-panel).
 */
export function ClinicalPanel({
  source,
  sourceLabel,
  title,
  subtitle,
  action,
  note,
  bodyClassName = "",
  className = "",
  children,
  ...props
}: ClinicalPanelProps) {
  return (
    <section
      className={`mf-panel ${className}`.trim()}
      data-source={source}
      {...props}
    >
      <div className="mf-panel__head">
        <div className="min-w-0">
          <h3 className="mf-panel__title m-0">{title}</h3>
          {subtitle ? (
            <p className="mf-panel__note m-0 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {source ? <SourceTag source={source} label={sourceLabel} /> : null}
          {action}
        </div>
      </div>
      <div className={`mf-panel__body ${bodyClassName}`.trim()}>
        {children}
        {note ? <p className="mf-panel__note m-0">{note}</p> : null}
      </div>
    </section>
  );
}
