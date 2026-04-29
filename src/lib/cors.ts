import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Always allow localhost in development
if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push(
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  );
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

// Respond to preflight OPTIONS requests
export function handleOptions(requestOrigin: string | null) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(requestOrigin),
      ...getSecurityHeaders(),
    },
  });
}

// Append CORS + security headers to any NextResponse
export function withHeaders(
  response: NextResponse,
  requestOrigin: string | null
): NextResponse {
  const corsHeaders = getCorsHeaders(requestOrigin);
  const secHeaders = getSecurityHeaders();

  for (const [key, value] of Object.entries({ ...corsHeaders, ...secHeaders })) {
    response.headers.set(key, value);
  }

  return response;
}
