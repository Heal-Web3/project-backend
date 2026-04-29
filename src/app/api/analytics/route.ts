import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { ok, forbidden, unauthorized, serverError } from "@/lib/response";
import { generateFraudSummary } from "@/lib/gemini";
import { FraudReason } from "@/lib/database.types";

type PrescriptionStat = { status: string; issued_at: string };
type FraudStat = {
  reason: string;
  severity: string;
  resolved: boolean;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    // Read auth context injected by middleware — no redundant Supabase calls
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();
    if (userRole !== "regulator") {
      return forbidden("Only regulators can access analytics.");
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const daysBack = Math.min(
      90,
      Math.max(1, parseInt(searchParams.get("days") ?? "7"))
    );
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const fromISO = fromDate.toISOString();

    // All 5 queries run in parallel — ~4x faster than sequential awaits
    const [
      prescriptionResult,
      fraudResult,
      dailyResult,
      activeDoctorsResult,
      revokedDoctorsResult,
    ] = await Promise.all([
      supabase
        .from("prescriptions")
        .select("status, issued_at")
        .gte("issued_at", fromISO),

      supabase
        .from("fraud_alerts")
        .select("reason, severity, resolved, created_at")
        .gte("created_at", fromISO),

      supabase
        .from("prescription_analytics")
        .select("*")
        .gte("date", fromISO)
        .order("date", { ascending: true }),

      supabase
        .from("doctors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      supabase
        .from("doctors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false),
    ]);

    const prescriptions: PrescriptionStat[] = (prescriptionResult.data ?? []) as PrescriptionStat[];
    const alerts: FraudStat[] = (fraudResult.data ?? []) as FraudStat[];

    const totalPrescriptions = prescriptions.length;
    const filledCount = prescriptions.filter((p) => p.status === "filled").length;
    const expiredCount = prescriptions.filter((p) => p.status === "expired").length;
    const revokedCount = prescriptions.filter((p) => p.status === "revoked").length;
    const activeCount = prescriptions.filter((p) => p.status === "active").length;

    const totalAlerts = alerts.length;
    const resolvedAlerts = alerts.filter((a) => a.resolved).length;

    const reasonCounts: Record<string, number> = {};
    for (const alert of alerts) {
      reasonCounts[alert.reason] = (reasonCounts[alert.reason] ?? 0) + 1;
    }
    const topReasons = Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason: reason as FraudReason, count }));

    const activeDoctors = activeDoctorsResult.count ?? 0;
    const revokedDoctors = revokedDoctorsResult.count ?? 0;

    const fraudRate =
      totalPrescriptions > 0
        ? ((totalAlerts / totalPrescriptions) * 100).toFixed(2)
        : "0.00";

    // AI summary — only call Gemini when there is something to summarize
    let aiSummary: string | null = null;
    if (totalAlerts > 0 && topReasons.length > 0) {
      try {
        aiSummary = await generateFraudSummary(totalAlerts, topReasons);
      } catch {
        aiSummary = null;
      }
    }

    return ok({
      period: {
        days: daysBack,
        from: fromISO,
        to: new Date().toISOString(),
      },
      prescriptions: {
        total: totalPrescriptions,
        filled: filledCount,
        expired: expiredCount,
        revoked: revokedCount,
        active: activeCount,
        fill_rate:
          totalPrescriptions > 0
            ? ((filledCount / totalPrescriptions) * 100).toFixed(2) + "%"
            : "0.00%",
      },
      fraud: {
        total_alerts: totalAlerts,
        resolved: resolvedAlerts,
        unresolved: totalAlerts - resolvedAlerts,
        fraud_rate: fraudRate + "%",
        by_severity: {
          high: alerts.filter((a) => a.severity === "high").length,
          medium: alerts.filter((a) => a.severity === "medium").length,
          low: alerts.filter((a) => a.severity === "low").length,
        },
        top_reasons: topReasons,
      },
      doctors: {
        active: activeDoctors,
        revoked: revokedDoctors,
        total: activeDoctors + revokedDoctors,
      },
      daily_breakdown: dailyResult.data ?? [],
      ai_summary: aiSummary,
    });
  } catch (err) {
    console.error("[analytics/GET] Unexpected error:", err);
    return serverError();
  }
}
