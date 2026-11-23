import { Button, Icon, type IconName } from "@/components/ui";

export interface DemoWorkspaceCardProps {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly loadingLabel: string;
  readonly icon: IconName;
  readonly emphasized?: boolean;
  readonly loading: boolean;
  readonly disabled: boolean;
  readonly testId: string;
  readonly onEnter: () => void;
}

export function DemoWorkspaceCard({
  title,
  description,
  actionLabel,
  loadingLabel,
  icon,
  emphasized = false,
  loading,
  disabled,
  testId,
  onEnter,
}: DemoWorkspaceCardProps) {
  return (
    <article
      className={`flex flex-col justify-between gap-6 rounded-[10px] border bg-[var(--mf-surface)] p-6 sm:p-7 transition-colors ${
        emphasized
          ? "border-[var(--mf-primary)]/45 border-t-[4px] border-t-[var(--mf-primary)] shadow-[0_1px_2px_rgba(11,29,46,0.06)]"
          : "border-[var(--mf-border)] border-t-[3px] border-t-[var(--mf-border-input)]"
      }`}
    >
      <div className="grid gap-3">
        <div
          className={`inline-flex h-11 w-11 items-center justify-center rounded-[8px] ${
            emphasized
              ? "bg-[var(--mf-primary-tint)] text-[var(--mf-primary-dark)]"
              : "bg-[var(--mf-surface-subtle)] text-[var(--mf-text)]"
          }`}
        >
          <Icon name={icon} size="md" />
        </div>

        <h2 className="m-0 text-[1.25rem] font-semibold leading-[1.25] text-[var(--mf-text)]">
          {title}
        </h2>

        <p className="m-0 text-[14.5px] leading-[1.55] text-[var(--mf-text-secondary)]">
          {description}
        </p>
      </div>

      <Button
        variant={emphasized ? "primary" : "secondary"}
        size="lg"
        fullWidth
        loading={loading}
        disabled={disabled}
        onClick={onEnter}
        data-testid={testId}
      >
        {loading ? loadingLabel : actionLabel}
        {!loading ? <Icon name="arrow" size="btn" /> : null}
      </Button>
    </article>
  );
}
