"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { PageContainer } from "@/components/layout/PageContainer";
import { FirebaseErrorBoundary } from "@/components/shared/FirebaseErrorBoundary";
import {
  StaffAccessGate,
  type AuthorizedStaffContext,
} from "@/components/staff/StaffAccessGate";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  Icon,
} from "@/components/ui";
import { auth, db } from "@/lib/firebase/client";
import {
  handleFirestoreError,
  isPermissionDeniedError,
  OperationType,
} from "@/lib/firebase/errors";

interface AuthorizedIntakeDetailProps extends AuthorizedStaffContext {
  readonly intakeId: string;
}

function AuthorizedIntakeDetail({
  intakeId,
  staffProfile,
  activeFacilityId,
}: AuthorizedIntakeDetailProps) {
  const [lookupState, setLookupState] = useState<
    "loading" | "not_found" | "denied" | "found"
  >("loading");
  const [recordMeta, setRecordMeta] = useState<{
    referenceCode: string;
    facilityId: string;
  } | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    let active = true;
    const intakePath = `intakes/${intakeId}`;

    getDoc(doc(db, "intakes", intakeId))
      .then((snap) => {
        if (!active) return;
        if (!snap.exists()) {
          setLookupState("not_found");
          return;
        }
        const data = snap.data();
        const facilityId =
          typeof data.facilityId === "string" ? data.facilityId : "";
        if (!staffProfile.facilityIds.includes(facilityId)) {
          setLookupState("denied");
          return;
        }
        setRecordMeta({
          referenceCode:
            typeof data.referenceCode === "string"
              ? data.referenceCode
              : snap.id,
          facilityId,
        });
        setLookupState("found");
      })
      .catch((error) => {
        if (!active) return;
        if (isPermissionDeniedError(error)) {
          setLookupState("denied");
          return;
        }
        try {
          handleFirestoreError(error, OperationType.GET, intakePath, auth);
        } catch (wrapped) {
          setFatalError(
            wrapped instanceof Error ? wrapped : new Error(String(wrapped)),
          );
        }
      });

    return () => {
      active = false;
    };
  }, [intakeId, staffProfile.facilityIds]);

  return (
    <PageContainer width="narrow">
      <Card>
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="m-0 text-[18px] font-bold text-[var(--mf-ink)]">
                Intake detail review
              </h1>
              <p className="m-0 text-[12px] text-[var(--mf-muted)]">
                Facility{" "}
                <code className="mf-mono text-[12px]">{activeFacilityId}</code>{" "}
                · Staff: {staffProfile.displayName}
              </p>
            </div>
            <Badge tone="brand">Facility-scoped</Badge>
          </div>

          {lookupState === "loading" && (
            <p className="m-0 text-[13px] text-[var(--mf-muted)]">
              Checking facility authorization for this intake record...
            </p>
          )}

          {lookupState === "not_found" && (
            <Alert tone="info" title="Intake record not found">
              No intake record with this identifier exists in your authorised
              facility.
            </Alert>
          )}

          {lookupState === "denied" && (
            <Alert tone="danger" title="Facility access denied">
              Firestore Security Rules blocked access to this record because it
              does not belong to your authorised facility assignments.
            </Alert>
          )}

          {lookupState === "found" && recordMeta && (
            <Alert tone="success" title={`Record ${recordMeta.referenceCode} authorized`}>
              Facility-scoped read succeeded for{" "}
              <code className="mf-mono text-[12px]">
                {recordMeta.facilityId}
              </code>
              . Evidence-linked AI brief review, staff corrections, and priority
              mutation controls will be implemented in Milestone 2/3.
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/staff/queue" variant="secondary" size="md">
              <Icon name="arrow" size="sm" className="rotate-180" />
              Back to staff queue
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </PageContainer>
  );
}

export function StaffIntakeDetailShell({ intakeId }: { intakeId: string }) {
  return (
    <FirebaseErrorBoundary title="Intake detail authorization error">
      <StaffAccessGate
        surfaceTitle="Staff authentication required"
        surfaceSubtitle="Intake detail & evidence review"
      >
        {(context) => (
          <AuthorizedIntakeDetail {...context} intakeId={intakeId} />
        )}
      </StaffAccessGate>
    </FirebaseErrorBoundary>
  );
}
