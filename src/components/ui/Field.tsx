import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export interface FormFieldProps {
  id: string;
  label: string;
  optional?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function getFieldDescribedBy(
  id: string,
  hint?: string,
  error?: string,
): string | undefined {
  const ids: string[] = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function FormField({
  id,
  label,
  optional = false,
  required = false,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`grid gap-1.5 min-w-0 ${className}`.trim()}>
      <label
        htmlFor={id}
        className="text-[12px] font-semibold text-[var(--mf-ink-secondary)]"
      >
        {label}
        {optional && (
          <span className="ml-1 font-normal text-[var(--mf-muted)]">
            (optional)
          </span>
        )}
        {required && (
          <span className="ml-1 text-[var(--mf-danger)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="m-0 text-[12px] text-[var(--mf-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="m-0 text-[12px] font-medium text-[var(--mf-danger)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_BASE =
  "w-full rounded-[8px] border bg-[var(--mf-surface)] px-3 py-2.5 text-[14px] text-[var(--mf-ink)] placeholder:text-[#8e9a94] transition duration-150 focus:outline-none focus:border-[var(--mf-brand)] mf-focus-ring disabled:bg-[var(--mf-surface-inset)] disabled:cursor-not-allowed";

function borderClass(hasError?: boolean): string {
  return hasError
    ? "border-[var(--mf-danger)]"
    : "border-[var(--mf-line-strong)]";
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function TextInput({
  hasError = false,
  className = "",
  ...rest
}: TextInputProps) {
  return (
    <input
      aria-invalid={hasError || undefined}
      className={`${CONTROL_BASE} min-h-[42px] ${borderClass(hasError)} ${className}`.trim()}
      {...rest}
    />
  );
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function Textarea({
  hasError = false,
  className = "",
  rows = 4,
  ...rest
}: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={hasError || undefined}
      className={`${CONTROL_BASE} min-h-[108px] resize-y leading-relaxed ${borderClass(hasError)} ${className}`.trim()}
      {...rest}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({
  hasError = false,
  className = "",
  children,
  ...rest
}: SelectProps) {
  return (
    <select
      aria-invalid={hasError || undefined}
      className={`${CONTROL_BASE} min-h-[42px] ${borderClass(hasError)} ${className}`.trim()}
      {...rest}
    >
      {children}
    </select>
  );
}
