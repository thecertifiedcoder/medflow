import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, ButtonLink, Card, CardBody } from "@/components/ui";

export default function NotFound() {
  return (
    <PageContainer width="narrow">
      <Card>
        <CardBody className="grid gap-4">
          <h1 className="mf-display m-0 text-[28px] font-normal text-[var(--mf-ink)]">
            Page not found
          </h1>
          <Alert tone="warning" title="Route unavailable">
            The requested page does not exist in this MedFlow workspace.
          </Alert>
          <div>
            <ButtonLink href="/" variant="primary" size="md">
              Return to overview
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
