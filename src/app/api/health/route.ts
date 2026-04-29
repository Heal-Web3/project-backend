import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/response";
import { createServiceClient } from "@/lib/supabase";

export async function GET(_request: NextRequest) {
  try {
    // Quick Supabase connectivity check
    const supabase = createServiceClient();
    const start = Date.now();
    const { error } = await supabase
      .from("user_profiles" as never)
      .select("id", { count: "exact", head: true });

    const dbLatencyMs = Date.now() - start;

    return ok({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
      services: {
        database: error ? "degraded" : "healthy",
        db_latency_ms: dbLatencyMs,
        rate_limiting: process.env.UPSTASH_REDIS_REST_URL ? "healthy" : "degraded",
      },
      environment: process.env.NODE_ENV ?? "unknown",
    });
  } catch (err) {
    console.error("[health/GET] Unexpected error:", err);
    return serverError("Health check failed.");
  }
}
