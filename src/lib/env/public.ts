export interface PublicConfig {
  readonly demoFacilityPublicCode: string;
  readonly appEnv: string;
}

const DEFAULT_DEMO_FACILITY_PUBLIC_CODE = "DEMO-FACILITY";

export function getPublicConfig(
  env: Record<string, string | undefined> = process.env,
): PublicConfig {
  const rawCode = env.NEXT_PUBLIC_DEMO_FACILITY_PUBLIC_CODE?.trim();
  const rawEnv = env.NEXT_PUBLIC_APP_ENV?.trim();

  return {
    demoFacilityPublicCode:
      rawCode && rawCode.length > 0 ? rawCode : DEFAULT_DEMO_FACILITY_PUBLIC_CODE,
    appEnv: rawEnv && rawEnv.length > 0 ? rawEnv : "development",
  };
}
