import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getCorsHeaders, getSecurityHeaders, handleOptions } from "@/lib/cors";
import type { UserRole } from "@/lib/database.types";

// ── Route permission map ───────────────────────────────────────────────────
// Empty array = public route (no auth required)
const PROTECTED_ROUTES: Record<string, string[]> = {
  "/api/health": [],
  "/api/auth/signup": [],
  "/api/auth/login": [],
  "/api/doctors/verify": ["pharmacist", "regulator"],
  "/api/doctors": ["doctor", "pharmacist", "regulator"],
  "/api/prescriptions": ["doctor", "pharmacist", "regulator"],
  "/api/fraud-check": ["pharmacist", "regulator"],
  "/api/analytics": ["regulator"],
  "/api/me": ["doctor", "pharmacist", "regulator"],
};

// ── Rate limit config per route prefix ────────────────────────────────────
const ROUTE_RATE_LIMITS = {
  "/api/auth": RATE_LIMITS.AUTH,
  "/api/fraud-check": RATE_LIMITS.AI,
  "/api/analytics": RATE_LIMITS.READ,
};

function matchRoute(
  pathname: string,
  routes: Record<string, unknown>,
): string | null {
  const matches = Object.keys(routes)
    .filter((route) => pathname.startsWith(route))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}

function addCommonHeaders(response: NextResponse, origin: string | null) {
  try {
    for (const [k, v] of Object.entries({
      ...getCorsHeaders(origin),
      ...getSecurityHeaders(),
    })) {
      response.headers.set(k, v);
    }
  } catch (err) {
    // ALLOWED_ORIGINS not set — log and continue without CORS headers
    console.error("[middleware] CORS header error:", err);
  }
}

function jsonError(
  message: string,
  status: number,
  code: string,
  origin: string | null,
) {
  const res = NextResponse.json(
    { success: false, error: message, code },
    { status },
  );
  addCommonHeaders(res, origin);
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") return handleOptions(origin);
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Rate limiting
  const rateLimitRoute = matchRoute(pathname, ROUTE_RATE_LIMITS);
  const limiter = rateLimitRoute
    ? ROUTE_RATE_LIMITS[rateLimitRoute as keyof typeof ROUTE_RATE_LIMITS]
    : RATE_LIMITS.DEFAULT;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1";

  let rateResult;
  try {
    rateResult = await limiter.limit(ip);
  } catch (error) {
    console.warn("⚠️ Rate limiter unavailable:", error);
    rateResult = {
      success: true,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
    };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((rateResult.reset - Date.now()) / 1000),
  );

  if (!rateResult.success) {
    const res = NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please slow down.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(retryAfterSeconds));
    res.headers.set("X-RateLimit-Limit", String(rateResult.limit));
    res.headers.set("X-RateLimit-Remaining", String(rateResult.remaining));
    res.headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(rateResult.reset / 1000)),
    );
    addCommonHeaders(res, origin);
    return res;
  }

  // Route permission check — longest prefix match
  const permissionRoute = matchRoute(pathname, PROTECTED_ROUTES);
  if (permissionRoute === null) {
    const res = NextResponse.next();
    addCommonHeaders(res, origin);
    return res;
  }

  const allowedRoles = PROTECTED_ROUTES[permissionRoute];

  // Public route
  if (allowedRoles.length === 0) {
    const res = NextResponse.next();
    addCommonHeaders(res, origin);
    return res;
  }

  // Auth token validation
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(
      "Missing or invalid Authorization header. Expected: Bearer <token>",
      401,
      "UNAUTHORIZED",
      origin,
    );
  }

  const token = authHeader.slice(7);
  let userId: string;
  try {
    const supabase = createServiceClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user)
      return jsonError(
        "Invalid or expired token. Please sign in again.",
        401,
        "UNAUTHORIZED",
        origin,
      );
    userId = user.id;
  } catch {
    return jsonError(
      "Authentication service unavailable.",
      503,
      "SERVICE_UNAVAILABLE",
      origin,
    );
  }

  // Role check — single DB call, result injected into headers for route handlers
  let userRole: UserRole;
  try {
    const supabase = createServiceClient();
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();
    const userProfile = profile as unknown as { role: UserRole } | null;
    if (error || !userProfile)
      return jsonError("User profile not found.", 403, "FORBIDDEN", origin);
    userRole = userProfile.role;
  } catch {
    return jsonError(
      "Authorization service unavailable.",
      503,
      "SERVICE_UNAVAILABLE",
      origin,
    );
  }

  if (!allowedRoles.includes(userRole)) {
    return jsonError(
      `Access denied. This endpoint requires one of: ${allowedRoles.join(", ")}.`,
      403,
      "FORBIDDEN",
      origin,
    );
  }

  // Inject user context into request headers so route handlers don't need to re-auth
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", userId);
  requestHeaders.set("x-user-role", userRole);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("X-RateLimit-Limit", String(rateResult.limit));
  res.headers.set("X-RateLimit-Remaining", String(rateResult.remaining));
  res.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(rateResult.reset / 1000)),
  );
  addCommonHeaders(res, origin);
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
// Upstash Redis uses Node.js APIs — must run on Node.js runtime, not Edge
export const runtime = "nodejs";