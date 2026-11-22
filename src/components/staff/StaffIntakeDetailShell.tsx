"use client";

import Link from "next/link";
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
  ClinicalPanel,
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
    <PageContainer width="standard">
      <nav aria-label="Breadcrumb" className="mf-crumbs mb-4">
        <Link href="/staff/queue">Patient queue</Link>
        <Icon
          name="chevron"
          size="sm"
          className="text-[var(--mf-text-secondary)]"
        />
        <span aria-current="page" className="mf-mono">
          {recordMeta?.referenceCode ?? intakeId}
        </span>
      </nav>

      <div className="mf-detail-head mb-6 justify-between">
        <div>
          <span className="mf-eyebrow">Facility-scoped intake record</span>
          <h1 className="mf-detail-head__id m-0 mt-1 text-[var(--mf-text)]">
            {recordMeta?.referenceCode ?? intakeId}
          </h1>
          <p className="mf-t-body-sm m-0 mt-1 text-[var(--mf-text-secondary)]">
            Facility{" "}
            <code className="mf-mono text-[13px] text-[var(--mf-text)]">
              {activeFacilityId}
            </code>{" "}
            · Reviewing staff: {staffProfile.displayName}
          </p>
        </div>
        <Badge tone="brand" icon="lock">
          Facility-scoped
        </Badge>
      </div>

      <ClinicalPanel
        source="nurse"
        sourceLabel="Staff detail view"
        title="Intake record authorization"
        subtitle="Verified through Firestore Security Rules and facility membership"
      >
        {lookupState === "loading" && (
          <div className="flex items-center gap-3 py-2">
            <Icon
              name="loader"
              size="md"
              spin
              className="text-[var(--mf-primary-dark)]"
            />
            <p className="mf-t-body-sm m-0 text-[var(--mf-text-secondary)]">
              Checking facility authorization for this intake record...
            </p>
          </div>
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
          <Alert
            tone="success"
            title={`Record ${recordMeta.referenceCode} authorized`}
          >
            Facility-scoped read succeeded for{" "}
            <code className="mf-mono text-[13px]">{recordMeta.facilityId}</code>
            . Evidence-linked AI brief review, deterministic Evidence Integrity
            verification, staff corrections, and operational priority controls
            will be enabled in Milestones 2 and 3.
          </Alert>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <ButtonLink href="/staff/queue" variant="secondary" size="md">
            <Icon name="arrowLeft" size="btn" />
            Back to staff queue
          </ButtonLink>
        </div>
      </ClinicalPanel>
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
