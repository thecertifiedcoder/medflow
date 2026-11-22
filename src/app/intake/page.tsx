import { PatientIntakeFlow } from "@/components/patient/PatientIntakeFlow";

export default function PatientIntakePage() {
  return (
    <div className="mf-pt" data-testid="patient-intake-shell">
      <PatientIntakeFlow />
    </div>
  );
}
