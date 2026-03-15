import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import type { ApiError, ApiSuccess } from "@/lib/contracts/common";

function baseEnvelope() {
  return {
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

export function jsonOk<T>(data: T, status = 200) {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    ...baseEnvelope(),
  };
  return NextResponse.json(body, { status });
}

export function jsonError(code: string, message: string, status = 400) {
  const body: ApiError = {
    ok: false,
    error: { code, message },
    ...baseEnvelope(),
  };
  return NextResponse.json(body, { status });
}
