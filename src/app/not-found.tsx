import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, ButtonLink, ClinicalPanel, Icon } from "@/components/ui";

export default function NotFound() {
  return (
    <PageContainer width="narrow">
      <ClinicalPanel
        title="Page not found"
        subtitle="Requested route unavailable"
      >
        <Alert tone="warning" title="Route unavailable">
          The requested page does not exist in this MedFlow workspace.
        </Alert>
        <div>
          <ButtonLink href="/" variant="primary" size="md">
            <Icon name="arrowLeft" size="btn" />
            Return to overview
          </ButtonLink>
        </div>
      </ClinicalPanel>
    </PageContainer>
  );
}
