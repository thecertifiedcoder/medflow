import { Alert } from "@/components/ui/Alert";

export interface DemoSafetyBannerProps {
  compact?: boolean;
  className?: string;
}

/**
 * Mandatory prototype and clinical safety notice (docs/07 §3 + docs/14 §11).
 * Never invents a local emergency phone number and never implies clinical validation.
 */
export function DemoSafetyBanner({
  compact = false,
  className = "",
}: DemoSafetyBannerProps) {
  return (
    <Alert
      tone="warning"
      icon="shield"
      title="DEMO ONLY — Do not enter real patient information"
      className={className}
    >
      {compact ? (
        <p className="m-0">
          MedFlow is a demonstration prototype, not an emergency service or
          diagnostic tool. If someone needs immediate help, alert hospital staff
          directly. Do not wait for this form or an AI response.
        </p>
      ) : (
        <p className="m-0">
          MedFlow is a demonstration prototype, not an emergency service or a
          diagnostic tool. Do not use this demo for real medical emergencies or
          enter real patient information. If someone needs urgent help, contact
          local emergency services or alert hospital staff directly. Do not wait
          for a digital form or AI response.
        </p>
      )}
    </Alert>
  );
}
