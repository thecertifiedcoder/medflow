import type { HTMLAttributes } from "react";

export interface BrandMarkProps {
  size?: "sm" | "md";
  onDark?: boolean;
  subtitle?: string;
  className?: string;
}

/**
 * MedFlow geometric signal-path brand mark and wordmark lockup.
 * Derived directly from the attached MedFlow standalone HTML design system:
 * an irregular narrative waveform resolves into a clean line ending at a clinical decision node.
 */
export function BrandMark({
  size = "md",
  onDark = false,
  subtitle,
  className = "",
}: BrandMarkProps) {
  const sizeClass = size === "sm" ? "mf-brand--sm" : "";
  const darkClass = onDark ? "mf-brand--on-dark" : "";

  return (
    <span className={`mf-brand ${sizeClass} ${darkClass} ${className}`.trim()}>
      <svg
        className="mf-brand__mark"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="40" height="40" rx="8" fill="#087E8B" />
        <path
          d="M5.5 21 H9 L11.5 14.5 L15 27.5 L18 16.5 L20.5 21 H28"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="31.5" cy="21" r="3.6" fill="#FFFFFF" />
      </svg>
      <span className="grid leading-none">
        <span className="mf-brand__word">
          Med<b>Flow</b>
        </span>
        {subtitle ? (
          <span
            className={`mf-brand__tag mt-1 ${
              onDark ? "" : "!text-[var(--mf-text-secondary)]"
            }`.trim()}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export interface SignalRuleProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * MedFlow signature section separator: waveform resolving into a horizontal rule and terminal dot.
 */
export function SignalRule({ className = "", ...props }: SignalRuleProps) {
  return (
    <div
      className={`mf-signal-rule ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      <svg viewBox="0 0 72 14" fill="none">
        <path
          d="M0 7 H14 L19 2 L24 12 L29 4 L34 7 H72"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span />
      <i />
    </div>
  );
}
