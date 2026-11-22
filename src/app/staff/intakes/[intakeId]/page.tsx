import { StaffIntakeDetailShell } from "@/components/staff/StaffIntakeDetailShell";

export default async function StaffIntakeDetailPage({
  params,
}: {
  params: Promise<{ intakeId: string }>;
}) {
  const { intakeId } = await params;
  return <StaffIntakeDetailShell intakeId={intakeId} />;
}
