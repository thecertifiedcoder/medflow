import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { Icon } from "./Icon";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quiet"
  | "destructive"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "mf-btn--primary",
  secondary: "mf-btn--secondary",
  tertiary: "mf-btn--tertiary",
  quiet: "mf-btn--tertiary",
  destructive: "mf-btn--destructive",
  danger: "mf-btn--destructive",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "mf-btn--sm",
  md: "",
  lg: "mf-btn--lg",
};

function getButtonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  className: string,
): string {
  return [
    "mf-btn",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? "mf-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  type = "button",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={getButtonClasses(variant, size, fullWidth, className)}
      {...props}
    >
      {loading ? <Icon name="loader" size="btn" spin /> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={getButtonClasses(variant, size, fullWidth, className)}
      {...props}
    >
      {children}
    </Link>
  );
}
