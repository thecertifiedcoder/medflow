import { NextResponse } from "next/server";

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function jsonError(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
