# MedFlow — Evidence Integrity Engine Specification

**Document ID:** MED-EVID-019  
**Status:** Founder-approved algorithm direction; implementation pending  
**Target:** Post-Milestone 2, after real intake and staff-triggered extraction exist  
**Purpose:** Make AI-extracted intake information auditable against the patient's immutable, confirmed narrative.

## 1. Product objective

The Evidence Integrity Engine is a deterministic verification layer around AI extraction. It checks whether each extracted item carries a source quotation that can be located in the exact patient-confirmed narrative and records the corresponding source span.

The differentiator is not merely that Gemini creates a structured summary. MedFlow must show staff where each extracted item came from, what the automated check established, and what still requires human review.

**The engine verifies provenance mechanics, not clinical truth.** An exact quote match proves that the quoted words occur in the source narrative. It does not prove that the AI interpreted those words correctly, that the claim is clinically accurate, or that the patient statement itself is true. Only an authorised human can review and accept or correct the intake.

## 2. Non-negotiable boundaries

- The engine is deterministic. The same narrative and extraction candidate must produce the same verification result.
- Gemini proposes structured claims and quotations; the server-side engine assigns evidence statuses and source offsets.
- The engine never diagnoses, predicts outcomes, assigns urgency, creates a clinical score, recommends treatment or changes queue priority/status.
- It does not decide that a patient is safe to wait.
- Missing or conflicting patient statements remain missing or conflicting. Do not resolve contradictions by guessing.
- The original confirmed narrative is immutable.
- The original AI draft, evidence-verification result and staff-reviewed copy remain distinct.
- Unsupported or ambiguous claims must never be displayed as verified facts.
- A source match is not a clinical validation result.
- The engine must not introduce a numeric confidence score or a single “trust score”. Show field-level evidence states instead.

## 3. Inputs and outputs

### Inputs

1. The immutable `confirmedNarrative` stored on the intake.
2. The intake identifier and facility context from the authorised record.
3. A candidate `ClinicalIntakeBrief` returned by the server-side Gemini extraction service.
4. Model ID, schema version and engine version.

### Output

A validated AI draft plus server-generated evidence metadata for each evidence-bearing field. The output is attached only through the approved authenticated staff-triggered extraction flow in the Starter Tier architecture.

### Evidence states

| State | Meaning | UI treatment |
|---|---|---|
| `exact_quote_match` | The supplied quotation occurs exactly once in the immutable narrative and a source span was derived. | Show the quotation and source location as a matched source. |
| `missing_quote` | The candidate contains no quotation for a claim that requires evidence. | Show “Source not provided”; require staff review. |
| `quote_not_found` | The quotation cannot be found as an exact substring. | Show “Source match not found”; do not present the claim as verified. |
| `ambiguous_quote` | The same quotation occurs more than once and cannot be uniquely located. | Show “Source location ambiguous”; require staff review. |

These labels describe string-level provenance only. Do not relabel them “clinically verified”, “true”, “accurate” or “safe”.

## 4. Deterministic verification algorithm

### Step 1 — Validate the candidate

- Parse the Gemini response as strict JSON.
- Validate against the versioned Zod extraction schema.
- Reject unknown keys and forbidden clinical-authority fields.
- Reject malformed or out-of-bounds content.
- Do not accept any evidence status, source offsets, narrative hash or provenance signature supplied by Gemini.

### Step 2 — Select evidence-bearing claims

Evidence is required for:
- chief concern;
- every symptom;
- every relevant-context item;
- every reported detail to review.

An explicit claim without a source quotation receives `missing_quote`. An unclear item may remain explicitly unclear, but it must not be represented as an evidence-backed explicit claim.

### Step 3 — Locate quotations

For each supplied `sourceQuote`:

1. Search the exact, unmodified `confirmedNarrative` using deterministic string matching.
2. Do not silently paraphrase, repair spelling, remove words, translate, or use fuzzy matching.
3. If there is no match, assign `quote_not_found`.
4. If there is exactly one match, assign `exact_quote_match` and derive the source span server-side.
5. If there are multiple matches, assign `ambiguous_quote` unless a later, separately tested disambiguation rule can prove the correct occurrence. Do not guess.

The source span uses JavaScript UTF-16 code-unit offsets with a half-open range: `[start, end)`. The server must verify that `confirmedNarrative.slice(start, end) === sourceQuote` before storing the span. Offsets are derived by the server; Gemini never supplies trusted offsets.

### Step 4 — Attach field-level verification metadata

For each evidence-bearing field, attach a server-generated result:

```ts
type EvidenceVerification = {
  status:
    | "exact_quote_match"
    | "missing_quote"
    | "quote_not_found"
    | "ambiguous_quote";
  sourceSpan?: {
    start: number; // UTF-16 code units, inclusive
    end: number;   // UTF-16 code units, exclusive
  };
  engineVersion: string;
};
```

Do not mutate the model's original claim text or quotation during verification. Keep candidate and verification metadata separable for audit and debugging.

### Step 5 — Bind provenance to the source

Create a server-generated provenance envelope containing at minimum:

- intake ID;
- hash of the exact confirmed narrative;
- hash of the canonical validated AI draft and verification metadata;
- model ID and extraction schema version;
- evidence engine version;
- creation timestamp;
- HMAC-SHA-256 signature.

The HMAC key is server-only and configured through the platform's secrets mechanism. Never commit it or expose it to browser code. The signature proves that the envelope was produced by the trusted server key and binds it to a particular narrative and draft. It does not prove clinical correctness.

### Step 6 — Persist through the approved Starter Tier boundary

- Extraction is triggered by an authenticated, active, facility-authorised staff session.
- Gemini runs in the server-side Next.js Route Handler.
- The server validates and signs the result.
- The authorised staff client persists the AI draft/provenance using the already-approved Firestore Web SDK path and hardened rules, paired with the required append-only system audit event as specified in D-015 and the technical architecture.
- Never introduce unauthenticated post-submission AI writes.
- Never use Firebase Admin Firestore writes, service-account keys or IAM workarounds on the Starter Tier project.
- Preserve the original narrative and prior AI draft; do not silently overwrite reviewed data.

## 5. Summary handling

The free-text `clinicianSummary` is an AI-generated draft, not independently verified evidence. It must be labelled as an AI draft and displayed alongside the original narrative and field-level evidence. Do not claim that every sentence in the free-text summary has been mechanically verified.

If a future version requires sentence-level summary traceability, define a versioned summary-segment contract in which each sentence references one or more evidence-bearing field IDs. Do not infer sentence-level support from a whole-document quote match.

## 6. Human review

The staff workspace must allow an authorised staff member to:

- inspect the original confirmed narrative;
- open the exact source quotation and its location;
- distinguish exact quote match, missing quote, quote not found and ambiguous quote;
- compare the AI draft with the source;
- correct or reject an extracted item;
- record a reason for material corrections;
- confirm or correct the brief without modifying the original narrative or original AI draft.

The staff-reviewed brief is stored separately and every review/correction action is audited.

## 7. Failure behaviour

- Schema-invalid output: reject the candidate and mark extraction failed.
- Unsupported or ambiguous quotation: retain the intake and original candidate for staff review, but do not render the claim as evidence-matched.
- HMAC verification failure: treat the provenance envelope as untrusted and block acceptance of that AI draft until reprocessing or staff review.
- Gemini/network failure: preserve the intake and show AI unavailable.
- Missing narrative hash or mismatch: block persistence/acceptance; never attach a draft to a different intake narrative.
- Do not hide, delete, de-prioritise or mark the intake complete because the engine failed.
- Retries must be bounded and staff-authorised.

## 8. Evaluation and test matrix

Use synthetic narratives only.

| Test | Input condition | Expected result |
|---|---|---|
| EIE-01 | One exact unique quotation | `exact_quote_match` with correct offsets. |
| EIE-02 | Quotation absent from narrative | `quote_not_found`. |
| EIE-03 | Explicit claim with no quotation | `missing_quote`. |
| EIE-04 | Same quotation appears twice | `ambiguous_quote`. |
| EIE-05 | Unicode and emoji before the quotation | Correct UTF-16 offsets and exact slice equality. |
| EIE-06 | Punctuation or spelling differs | No fuzzy acceptance; `quote_not_found`. |
| EIE-07 | Candidate includes a forbidden diagnosis/priority field | Strict schema rejection. |
| EIE-08 | Narrative includes prompt-injection instructions | Treat as patient data; extraction task remains unchanged. |
| EIE-09 | Narrative contains contradictory statements | Preserve both source statements; do not resolve the contradiction. |
| EIE-10 | Narrative changes after draft creation | Hash mismatch; provenance verification fails. |
| EIE-11 | Draft or metadata modified after signing | HMAC verification fails. |
| EIE-12 | Gemini unavailable | Intake remains visible; AI state is failed/unavailable. |

### Acceptance criteria

- Every evidence-bearing claim has an explicit field-level evidence state.
- A unique exact quotation has a correct server-derived source span.
- No unsupported, missing or ambiguous quotation is presented as a matched source.
- Evidence metadata is generated server-side, never trusted from the model or browser.
- Provenance is bound to the exact immutable narrative and validated draft.
- Human review/correction remains mandatory.
- No clinical score, urgency label, diagnosis, treatment or queue decision is produced.
- Tests demonstrate deterministic repeatability on the synthetic evaluation set.

## 9. Implementation sequence

- **Milestone 2:** implement patient typed/voice intake, durable persistence, staff-triggered server-side Gemini extraction and the existing strict schema. Keep source quotes visible, but do not claim the full engine is implemented until its deterministic checks and provenance tests pass.
- **Milestone 3:** implement the Evidence Integrity Engine, source-span derivation, field-level states, provenance signing/verification and staff review UI.
- **Before judging:** demonstrate at least one exact match, one unsupported quote, one ambiguous quote and a preserved original narrative. Explain clearly that the algorithm checks source traceability, not clinical truth.

## 10. Explicitly deferred

Adult TEWS, SATS classifications, clinical time targets, vital-sign scoring, predictive risk, diagnosis, treatment recommendations, autonomous triage and pediatric scoring are not part of this engine or the approved MVP. Any future clinical scoring proposal requires a separate clinical governance decision, authoritative protocol source, local validation plan and founder approval.
