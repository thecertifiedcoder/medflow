"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import {
  Alert,
  Button,
  ButtonLink,
  ClinicalPanel,
  Icon,
} from "@/components/ui";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer width="narrow">
      <ClinicalPanel
        title="Something went wrong"
        subtitle="Safe recovery fallback"
      >
        <Alert tone="danger" title="Unexpected application error">
          A safe fallback has been shown without exposing internal details. If
          someone needs immediate medical help, alert hospital staff directly.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            <Icon name="refresh" size="btn" />
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary">
            Return to overview
          </ButtonLink>
        </div>
      </ClinicalPanel>
    </PageContainer>
  );
}
