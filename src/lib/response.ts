import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, string[]>;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

// Standard success response
export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    { success: true, data, ...(meta ? { meta } : {}) } satisfies ApiSuccessResponse<T>,
    { status }
  );
}

// Standard created response
export function created<T>(data: T) {
  return ok(data, undefined, 201);
}

// Standard error responses
export function badRequest(message: string, details?: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, error: message, code: "BAD_REQUEST", ...(details ? { details } : {}) } satisfies ApiErrorResponse,
    { status: 400 }
  );
}

export function unauthorized(message = "Unauthorized. Please sign in.") {
  return NextResponse.json(
    { success: false, error: message, code: "UNAUTHORIZED" } satisfies ApiErrorResponse,
    { status: 401 }
  );
}

export function forbidden(message = "You do not have permission to perform this action.") {
  return NextResponse.json(
    { success: false, error: message, code: "FORBIDDEN" } satisfies ApiErrorResponse,
    { status: 403 }
  );
}

export function notFound(resource = "Resource") {
  return NextResponse.json(
    { success: false, error: `${resource} not found.`, code: "NOT_FOUND" } satisfies ApiErrorResponse,
    { status: 404 }
  );
}

export function conflict(message: string) {
  return NextResponse.json(
    { success: false, error: message, code: "CONFLICT" } satisfies ApiErrorResponse,
    { status: 409 }
  );
}

export function serverError(message = "An unexpected error occurred. Please try again.") {
  return NextResponse.json(
    { success: false, error: message, code: "INTERNAL_SERVER_ERROR" } satisfies ApiErrorResponse,
    { status: 500 }
  );
}

// Handle Zod validation errors consistently
export function validationError(error: ZodError) {
  return badRequest("Validation failed.", error.flatten().fieldErrors as Record<string, string[]>);
}

// Parse request body safely
export async function parseBody<T>(
  request: Request,
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: ZodError } }
): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: badRequest("Request body must be valid JSON.") };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: validationError(result.error) };
  }

  return { data: result.data };
}

// Pagination helper
export function paginate(searchParams: URLSearchParams, maxLimit = 100) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Build paginated response
export function paginatedOk<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return NextResponse.json({
    success: true,
    data: items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}
