import { NextResponse } from "next/server";

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId?: string;
  };
}

export class AppHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;

  constructor(status: number, code: string, publicMessage: string) {
    super(publicMessage);
    this.name = "AppHttpError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  options?: { readonly requestId?: string },
): NextResponse<ApiErrorBody> {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
  };
  if (options?.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      },
    },
    {
      status,
      headers,
    },
  );
}
