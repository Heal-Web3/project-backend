import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ok,
  notFound,
  forbidden,
  unauthorized,
  serverError,
  parseBody,
} from "@/lib/response";
import { resolveFraudAlertSchema } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Defense-in-depth: verify middleware injected auth context
    const userId = request.headers.get("x-user-id");
    if (!userId) return unauthorized();

    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("fraud_alerts" as never)
      .select(
        `id, prescription_hash, patient_identifier, pharmacy_wallet, reason, severity,
         ai_explanation, action_required, smart_contract_response, resolved, resolved_at,
         resolution_notes, created_at, doctors(id, full_name, license_number, wallet_address)`
      )
      .eq("id", id)
      .single();

    if (error || !data) return notFound("Fraud alert");
    return ok(data as Record<string, unknown>);
  } catch (err) {
    console.error("[fraud-check/[id]/GET] Unexpected error:", err);
    return serverError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();
    if (userRole !== "regulator") {
      return forbidden("Only regulators can resolve fraud alerts.");
    }

    const { id } = await params;
    const parsed = await parseBody(request, resolveFraudAlertSchema);
    if ("error" in parsed) return parsed.error;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("fraud_alerts" as never)
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: parsed.data.resolution_notes,
      } as never)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return notFound("Fraud alert");
    const alert = data as Record<string, unknown>;
    return ok({
      ...alert,
      message: "Fraud alert marked as resolved.",
    });
  } catch (err) {
    console.error("[fraud-check/[id]/PATCH] Unexpected error:", err);
    return serverError();
  }
}
