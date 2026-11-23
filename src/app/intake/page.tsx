import { PatientIntakeFlow } from "@/components/patient/PatientIntakeFlow";

export default function PatientIntakePage() {
  return (
    <main
      className="mx-auto w-full max-w-[540px] px-4 py-5 sm:px-6 sm:py-8"
      data-testid="patient-intake-shell"
    >
      <PatientIntakeFlow />
    </main>
  );
}
