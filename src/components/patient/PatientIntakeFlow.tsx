"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ClinicalPanel,
  Icon,
  SourceTag,
} from "@/components/ui";
import { CANONICAL_DEMO_FACILITY } from "@/db/invariants";
import { INTAKE_LIMITS, type InputMode } from "@/lib/schemas/intake";

interface SyntheticExamplePreset {
  readonly id: string;
  readonly label: string;
  readonly displayName: string;
  readonly age: string;
  readonly narrative: string;
}

const SYNTHETIC_EXAMPLE_PRESETS: readonly SyntheticExamplePreset[] = [
  {
    id: "chest-tightness",
    label: "Example 1: Chest tightness & dizziness (English)",
    displayName: "Adebayo O. (Synthetic Demo)",
    age: "54",
    narrative:
      "I started feeling tightness in the center of my chest about two hours ago after climbing the stairs. I also feel lightheaded and slightly short of breath when walking. I take amlodipine for high blood pressure.",
  },
  {
    id: "pidgin-fever",
    label: "Example 2: Fever & headache (Nigerian English / Pidgin)",
    displayName: "Chidinma K. (Synthetic Demo)",
    age: "29",
    narrative:
      "Since yesterday night my body dey hot well well and I get strong headache behind my eyes. I vomit once this morning after drinking water and my joints dey pain me.",
  },
  {
    id: "vague-fatigue",
    label: "Example 3: Brief concern needing nurse clarification",
    displayName: "Tunde M. (Synthetic Demo)",
    age: "41",
    narrative:
      "I just do not feel fine since morning and my body feels weak.",
  },
];

const PATIENT_JOURNEY_STEPS = [
  { step: "1", label: "Instructions & Details" },
  { step: "2", label: "Reason for Visit (Type or Speak)" },
  { step: "3", label: "Review & Confirm Statement" },
] as const;

export function PatientIntakeFlow() {
  const [inputMode, setInputMode] = useState<InputMode>("typed");
  const [patientDisplayName, setPatientDisplayName] = useState<string>("");
  const [ageText, setAgeText] = useState<string>("");
  const [narrative, setNarrative] = useState<string>("");
  const [patientConfirmed, setPatientConfirmed] = useState<boolean>(false);

  const handleApplySyntheticPreset = (preset: SyntheticExamplePreset) => {
    setPatientDisplayName(preset.displayName);
    setAgeText(preset.age);
    setNarrative(preset.narrative);
    setPatientConfirmed(false);
  };

  const handleClearDraft = () => {
    setPatientDisplayName("");
    setAgeText("");
    setNarrative("");
    setPatientConfirmed(false);
  };

  const trimmedNarrative = narrative.trim();
  const hasValidNarrativeLength =
    trimmedNarrative.length >= INTAKE_LIMITS.minNarrativeLength;

  return (
    <div className="grid min-w-0 gap-5" data-testid="patient-intake-flow">
      {/* 1. Prominent Emergency Human-Help Safety Banner */}
      <Alert
        tone="danger"
        title="Need immediate medical help? Speak to clinic staff right now"
      >
        If you have severe chest pain, difficulty breathing, heavy bleeding,
        sudden weakness, or feel faint,{" "}
        <strong>
          do not wait to complete this form — alert the front desk or nursing
          staff in person immediately
        </strong>
        . MedFlow is an intake assistant, not a doctor.
      </Alert>

      {/* Patient Introduction & Progress Bar */}
      <div className="mf-pt__bar flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag source="patient" label="Patient Self-Intake" />
          <span className="text-[13px] font-medium text-[var(--mf-text-secondary)]">
            {CANONICAL_DEMO_FACILITY.name} (
            <code className="mf-mono text-[12px] text-[var(--mf-text)]">
              {CANONICAL_DEMO_FACILITY.publicCode}
            </code>
            )
          </span>
        </div>
        <Badge tone="neutral">Synthetic demo · No real PHI</Badge>
      </div>

      <div className="min-w-0">
        <h1 className="mf-pt__title">
          Tell the clinic staff what brings you in today
        </h1>
        <p className="mf-pt__lead">
          Share your symptoms in your own words (including Nigerian English or
          Pidgin). You will review and confirm your exact statement before it is
          shared with clinical staff.
        </p>

        {/* Visual 3-Step Patient Journey Indicator */}
        <ol
          aria-label="Patient intake steps"
          className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-3"
        >
          {PATIENT_JOURNEY_STEPS.map((item) => (
            <li
              key={item.step}
              className="flex min-w-0 items-center gap-2.5 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface)] px-3.5 py-2.5"
            >
              <span className="mf-mono inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[var(--mf-primary)] text-[12px] font-semibold text-white">
                {item.step}
              </span>
              <span className="text-[13.5px] font-semibold text-[var(--mf-text)]">
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Main Patient Form Surface */}
      <div className="mf-pt__form min-w-0">
        {/* Step 1: Optional Patient Information */}
        <section
          aria-labelledby="pt-step-1-heading"
          className="grid min-w-0 gap-4 border-b border-[var(--mf-border)] pb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="pt-step-1-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Step 1 · Your details (optional)
            </h2>
            <Badge tone="neutral">Synthetic identifiers only</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="mf-field">
              <label htmlFor="patient-display-name" className="mf-label">
                <span>Name or alias</span>
                <span className="mf-label__req">Optional</span>
              </label>
              <input
                id="patient-display-name"
                type="text"
                className="mf-input mf-input--lg"
                maxLength={INTAKE_LIMITS.maxDisplayNameLength}
                placeholder="e.g., Adebayo O. (Synthetic)"
                value={patientDisplayName}
                onChange={(e) => setPatientDisplayName(e.target.value)}
                data-testid="patient-name-input"
              />
            </div>

            <div className="mf-field">
              <label htmlFor="patient-age" className="mf-label">
                <span>Age in years</span>
                <span className="mf-label__req">Optional (0–120)</span>
              </label>
              <input
                id="patient-age"
                type="number"
                inputMode="numeric"
                min={0}
                max={INTAKE_LIMITS.maxAge}
                className="mf-input mf-input--lg"
                placeholder="e.g., 34"
                value={ageText}
                onChange={(e) => setAgeText(e.target.value)}
                data-testid="patient-age-input"
              />
            </div>
          </div>
        </section>

        {/* Step 2: Choose Input Mode & Describe Reason for Visit */}
        <section
          aria-labelledby="pt-step-2-heading"
          className="grid min-w-0 gap-4 border-b border-[var(--mf-border)] pb-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="pt-step-2-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Step 2 · Reason for your visit
            </h2>
            <SourceTag
              source="patient"
              label={inputMode === "voice" ? "Voice Mode" : "Typed Mode"}
            />
          </div>

          <fieldset className="mf-seg mf-seg--lg min-w-0">
            <legend className="mf-seg__legend">
              How would you like to share your concern?
            </legend>
            <div
              className="mf-seg__opts"
              role="radiogroup"
              aria-label="Intake input mode"
            >
              <label
                className="mf-seg__opt"
                data-testid="mode-typed-btn"
                onClick={() => setInputMode("typed")}
              >
                <input
                  type="radio"
                  name="intakeInputMode"
                  value="typed"
                  checked={inputMode === "typed"}
                  onChange={() => setInputMode("typed")}
                />
                <span>
                  <Icon name="clipboard" size="btn" />
                  Type my concern
                </span>
              </label>

              <label
                className="mf-seg__opt"
                data-testid="mode-voice-btn"
                onClick={() => setInputMode("voice")}
              >
                <input
                  type="radio"
                  name="intakeInputMode"
                  value="voice"
                  checked={inputMode === "voice"}
                  onChange={() => setInputMode("voice")}
                />
                <span>
                  <Icon name="mic" size="btn" />
                  Speak my concern
                </span>
              </label>
            </div>
          </fieldset>

          {/* Optional Synthetic Presets for Quick Inspection */}
          <div className="min-w-0 rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-[var(--mf-text-secondary)]">
                Load a synthetic patient example to preview the review flow:
              </span>
              {narrative.length > 0 && (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={handleClearDraft}
                >
                  Clear fields
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SYNTHETIC_EXAMPLE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="!h-auto !whitespace-normal !py-2 text-left"
                  onClick={() => handleApplySyntheticPreset(preset)}
                  data-testid={`preset-${preset.id}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {inputMode === "voice" && (
            <div
              className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4"
              data-testid="voice-intake-panel"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--mf-text)]">
                  <Icon name="mic" size="md" />
                  Voice Capture &amp; Transcript Review Stage
                </div>
                <Badge tone="info">Milestone 2 Voice Pipeline</Badge>
              </div>
              <p className="m-0 text-[13.5px] text-[var(--mf-text-secondary)]">
                In voice mode, patients record a spoken statement (up to 90
                seconds; raw audio is never stored), receive a draft transcript,
                and edit or confirm the written statement in the box below
                before submission. Server-side Gemini voice transcription (
                <code className="mf-mono text-[12px]">
                  POST /api/intakes/transcribe
                </code>
                ) activates in Milestone 2. You can preview or edit the
                transcript box directly below.
              </p>
            </div>
          )}

          <div className="mf-field">
            <label
              htmlFor="confirmed-narrative"
              className="mf-label justify-between"
            >
              <span>
                {inputMode === "voice"
                  ? "Written transcript for your review and correction"
                  : "Describe your symptoms in your own words"}
              </span>
              <span className="mf-mono text-[12px] font-normal text-[var(--mf-text-muted)]">
                {trimmedNarrative.length} / {INTAKE_LIMITS.maxNarrativeLength}{" "}
                chars
              </span>
            </label>

            <div className="mf-help">
              Include when your symptoms started, how they feel, and any
              medications or allergies you want the nurse or doctor to know.
            </div>

            <textarea
              id="confirmed-narrative"
              className="mf-textarea mf-textarea--lg"
              rows={5}
              maxLength={INTAKE_LIMITS.maxNarrativeLength}
              placeholder="Example: I started feeling tightness in the center of my chest about two hours ago after climbing the stairs..."
              value={narrative}
              onChange={(e) => {
                setNarrative(e.target.value);
                setPatientConfirmed(false);
              }}
              data-testid="confirmed-narrative-textarea"
            />
          </div>
        </section>

        {/* Step 3: Review & Confirm Captured Statement */}
        <section
          aria-labelledby="pt-step-3-heading"
          className="grid gap-4"
          data-testid="patient-review-step"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="pt-step-3-heading"
              className="mf-t-section m-0 text-[var(--mf-text)]"
            >
              Step 3 · Review and confirm your statement
            </h2>
            <Badge tone={patientConfirmed ? "success" : "neutral"}>
              {patientConfirmed ? "Statement confirmed" : "Review required"}
            </Badge>
          </div>

          {hasValidNarrativeLength ? (
            <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="mf-eyebrow">
                  Statement preview for clinical staff
                </span>
                <span className="mf-mono text-[12px] text-[var(--mf-text-secondary)]">
                  {patientDisplayName.trim() || "Walk-in Patient (Anonymous)"}
                  {ageText.trim() ? ` · ${ageText.trim()}y` : ""}
                </span>
              </div>
              <blockquote className="mf-quote m-0">
                &ldquo;{trimmedNarrative}&rdquo;
              </blockquote>
            </div>
          ) : (
            <p className="m-0 text-[14px] text-[var(--mf-text-secondary)]">
              Enter at least {INTAKE_LIMITS.minNarrativeLength} characters above
              (or choose a synthetic example) to preview your confirmed
              statement.
            </p>
          )}

          <div className="rounded-[4px] border border-[var(--mf-border)] bg-[var(--mf-surface-subtle)] p-4">
            <label
              htmlFor="patient-confirm-checkbox"
              className="flex cursor-pointer items-start gap-3 text-[15px] font-medium leading-[1.48] text-[var(--mf-text)]"
            >
              <input
                id="patient-confirm-checkbox"
                type="checkbox"
                checked={patientConfirmed}
                disabled={!hasValidNarrativeLength}
                onChange={(e) => setPatientConfirmed(e.target.checked)}
                data-testid="patient-confirm-checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--mf-primary)]"
              />
              <span>
                I have reviewed the statement above and confirm it accurately
                reflects what I want the clinic staff to read. I understand this
                is a synthetic demonstration prototype and does not provide
                medical advice or clearance to wait.
              </span>
            </label>
          </div>

          {/* Honest UX-1 Phase Boundary Banner (No Fake Submission Success) */}
          <Alert
            tone="info"
            title="Phase UX-1 Architecture Ready — Live Submission Activates in Milestone 2"
          >
            <div className="grid gap-2">
              <span>
                This dedicated patient experience establishes the complete
                mobile-first intake journey and statement confirmation flow. In
                accordance with the approved Phase UX-1 boundary, live database
                submission (<code className="mf-mono">POST /api/intakes</code>),
                voice transcription (
                <code className="mf-mono">POST /api/intakes/transcribe</code>),
                and server-side Gemini extraction are scheduled for{" "}
                <strong>Milestone 2</strong> and are not simulated here.
              </span>
            </div>
          </Alert>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mf-border)] pt-4">
            <ButtonLink href="/" variant="secondary" size="md">
              <Icon name="arrowLeft" size="btn" />
              Return to Home
            </ButtonLink>
          </div>
        </section>
      </div>

      {/* What Happens After Submission (Patient-Friendly Transparency) */}
      <ClinicalPanel
        source="patient"
        sourceLabel="What happens next"
        title="How clinic staff receive your confirmed statement"
        subtitle="Your words remain intact from check-in to clinical review."
      >
        <ol className="m-0 grid list-none gap-2.5 p-0 text-[14px] text-[var(--mf-text-secondary)]">
          <li className="flex items-start gap-2.5">
            <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-surface-subtle)] text-[11px] font-semibold text-[var(--mf-text)]">
              1
            </span>
            <span>
              <strong className="text-[var(--mf-text)]">
                Stored verbatim:
              </strong>{" "}
              Your confirmed statement is saved immutably in the facility intake
              queue and assigned a patient reference code.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-surface-subtle)] text-[11px] font-semibold text-[var(--mf-text)]">
              2
            </span>
            <span>
              <strong className="text-[var(--mf-text)]">
                Evidence-linked summary:
              </strong>{" "}
              MedFlow drafts a structured summary for the nurse or doctor where
              every extracted detail points back to your exact words.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mf-mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--mf-surface-subtle)] text-[11px] font-semibold text-[var(--mf-text)]">
              3
            </span>
            <span>
              <strong className="text-[var(--mf-text)]">
                Human clinician review:
              </strong>{" "}
              A qualified nurse or doctor reviews your statement and assigns
              operational review priority.
            </span>
          </li>
        </ol>
      </ClinicalPanel>
    </div>
  );
}
