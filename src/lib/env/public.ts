export interface PublicConfig {
  readonly demoFacilityPublicCode: string;
  readonly appEnv: string;
}

const DEFAULT_DEMO_FACILITY_PUBLIC_CODE = "DEMO-CLINIC-01";
const RETIRED_DEMO_FACILITY_PUBLIC_CODE = "DEMO-FACILITY";

export function getPublicConfig(
  env: Record<string, string | undefined> = process.env,
): PublicConfig {
  const rawCode = env.NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE?.trim();
  const rawEnv = env.NEXT_PUBLIC_APP_ENV?.trim();
  const normalizedCode =
    !rawCode ||
    rawCode.length === 0 ||
    rawCode.toUpperCase() === RETIRED_DEMO_FACILITY_PUBLIC_CODE
      ? DEFAULT_DEMO_FACILITY_PUBLIC_CODE
      : rawCode;

  return {
    demoFacilityPublicCode: normalizedCode,
    appEnv: rawEnv && rawEnv.length > 0 ? rawEnv : "development",
  };
}
