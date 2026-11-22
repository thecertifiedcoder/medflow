import Link, { type LinkProps } from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-[9px] border font-semibold leading-tight transition duration-150 ease-out cursor-pointer select-none focus-visible:outline-none mf-focus-ring disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--mf-brand)] bg-[var(--mf-brand)] text-white hover:bg-[var(--mf-brand-strong)] hover:border-[var(--mf-brand-strong)] hover:-translate-y-px active:translate-y-0",
  secondary:
    "border-[var(--mf-line-strong)] bg-[var(--mf-surface)] text-[var(--mf-ink-secondary)] hover:bg-[var(--mf-surface-soft)] hover:border-[#aebdb2] hover:-translate-y-px active:translate-y-0",
  quiet:
    "border-transparent bg-transparent text-[var(--mf-brand)] hover:bg-[var(--mf-brand-tint)]",
  danger:
    "border-[#efd1cc] bg-[var(--mf-danger-soft)] text-[var(--mf-danger)] hover:bg-[#f3dcd8]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[34px] px-3 py-1.5 text-[12px]",
  md: "min-h-[40px] px-4 py-2 text-[13px]",
  lg: "min-h-[46px] px-5 py-3 text-[14px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Link>
  );
}
