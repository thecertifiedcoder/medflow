"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, Button, ButtonLink, Card, CardBody } from "@/components/ui";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer width="narrow">
      <Card>
        <CardBody className="grid gap-4">
          <h1 className="mf-display m-0 text-[28px] font-normal text-[var(--mf-ink)]">
            Something went wrong
          </h1>
          <Alert tone="danger" title="Unexpected application error">
            A safe fallback has been shown without exposing internal details. If
            someone needs immediate medical help, alert hospital staff directly.
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
            <ButtonLink href="/" variant="secondary">
              Return to overview
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
