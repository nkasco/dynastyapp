import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiErrorCode } from "@/contracts/api";

const statusByCode: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = statusByCode[code],
  ) {
    super(message);
  }
}

export function requestMeta() {
  return { requestId: randomUUID() };
}

export function apiOk<TData>(data: TData, status = 200) {
  return NextResponse.json({ ok: true, data, meta: requestMeta() }, { status });
}

export function apiFail(code: ApiErrorCode, message: string, status = statusByCode[code], issues?: { path: string; message: string }[]) {
  return NextResponse.json({ ok: false, error: { code, message, issues }, meta: requestMeta() }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiFail(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    return apiFail(
      "BAD_REQUEST",
      "The request did not match the API contract.",
      400,
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }

  console.error(error);
  return apiFail("INTERNAL_ERROR", "Something went wrong while handling that request.");
}

export async function readJson(request: Request) {
  if (!request.body) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "Request body must be valid JSON.");
  }
}
