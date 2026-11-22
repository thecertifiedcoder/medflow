import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon } from "./Icon";

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible form field wrapper following HTML section 07 rules:
 * label -> explicit "Required" or "Optional" in plain words -> hint ABOVE input -> control -> error with icon.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  optional = false,
  children,
  className = "",
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`mf-field ${className}`.trim()}>
      <label htmlFor={id} className="mf-label">
        {label}
        {required ? (
          <span className="mf-label__req">Required</span>
        ) : optional ? (
          <span className="mf-label__req">Optional</span>
        ) : null}
      </label>

      {hint ? (
        <span id={hintId} className="mf-hint">
          {hint}
        </span>
      ) : null}

      {children}

      {error ? (
        <span id={errorId} role="alert" className="mf-error">
          <Icon name="circleAlert" size="sm" />
          <span>
            <span className="mf-sr-only">Error: </span>
            {error}
          </span>
        </span>
      ) : null}
    </div>
  );
}

export type FieldControlSize = "md" | "lg";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  fieldSize?: FieldControlSize;
}

export function TextInput({
  invalid = false,
  fieldSize = "md",
  className = "",
  ...props
}: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`mf-input ${fieldSize === "lg" ? "mf-input--lg" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  fieldSize?: FieldControlSize;
}

export function Textarea({
  invalid = false,
  fieldSize = "md",
  className = "",
  ...props
}: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={`mf-textarea ${fieldSize === "lg" ? "mf-textarea--lg" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  fieldSize?: FieldControlSize;
}

export function Select({
  invalid = false,
  fieldSize = "md",
  className = "",
  ...props
}: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`mf-select ${fieldSize === "lg" ? "mf-select--lg" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

export function getFieldDescribedBy(
  id: string,
  opts: { hasHint?: boolean; hasError?: boolean },
): string | undefined {
  const ids: string[] = [];
  if (opts.hasHint) ids.push(`${id}-hint`);
  if (opts.hasError) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
