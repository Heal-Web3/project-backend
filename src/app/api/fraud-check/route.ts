import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ok,
  forbidden,
  unauthorized,
  serverError,
  parseBody,
  paginatedOk,
  paginate,
} from "@/lib/response";
import { generateFraudExplanation, FraudContext } from "@/lib/gemini";
import { fraudCheckSchema } from "@/lib/schemas";
import { FraudReason } from "@/lib/database.types";

type DoctorRow = { id: string; full_name: string };
type VerificationLog = { pharmacy_wallet: string };
type PrescriptionRow = { expiry_date: string };

function mapContractReason(raw: string): FraudReason {
  const r = raw.toLowerCase();
  if (r.includes("daily limit") || r.includes("30 prescription"))
    return "doctor_daily_limit_exceeded";
  if (
    r.includes("pharmacy") &&
    (r.includes("patient") || r.includes("visited"))
  )
    return "patient_pharmacy_limit_exceeded";
  if (r.includes("revoked") || r.includes("license"))
    return "doctor_license_revoked";
  if (r.includes("expired")) return "prescription_expired";
  if (
    r.includes("not registered") ||
    r.includes("not found") ||
    r.includes("no nft")
  )
    return "doctor_not_registered";
  return "invalid_signature";
}

export async function POST(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();
    if (!["pharmacist", "regulator"].includes(userRole)) {
      return forbidden(
        "Only pharmacists and regulators can submit fraud checks.",
      );
    }

    const parsed = await parseBody(request, fraudCheckSchema);
    if ("error" in parsed) return parsed.error;

    const data = parsed.data;
    const supabase = createServiceClient();
    const fraudReason = mapContractReason(data.smart_contract_reason);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Parallelise all independent DB lookups
    type NullResult = { data: null; error: null };
    const nullResult: NullResult = { data: null, error: null };

    const [doctorResult, pharmacyLogsResult, prescriptionResult] =
      await Promise.all([
        data.doctor_wallet
          ? supabase
              .from("doctors" as never)
              .select("id, full_name")
              .eq("wallet_address", data.doctor_wallet)
              .single()
              .then((r) => r as unknown as NullResult)
          : Promise.resolve(nullResult),

        data.patient_identifier && data.prescription_hash
          ? supabase
              .from("verification_logs" as never)
              .select("pharmacy_wallet")
              .eq("prescription_hash", data.prescription_hash)
              .gte("created_at", todayISO)
              .eq("verified", true)
              .then((r) => r as unknown as NullResult)
          : Promise.resolve(nullResult),

        !data.expiry_date && data.prescription_hash
          ? supabase
              .from("prescriptions" as never)
              .select("expiry_date")
              .eq("prescription_hash", data.prescription_hash)
              .single()
              .then((r) => r as unknown as NullResult)
          : Promise.resolve(nullResult),
      ]);

    let doctorName: string | undefined;
    let doctorId: string | undefined;
    let prescriptionCount: number | undefined;

    if (doctorResult.data) {
      const doctor = doctorResult.data as unknown as DoctorRow;
      doctorName = doctor.full_name;
      doctorId = doctor.id;

      // Doctor's prescription count today — can run after we have doctorId
      const { count } = await supabase
        .from("prescriptions" as never)
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctor.id)
        .gte("issued_at", todayISO);
      prescriptionCount = count ?? undefined;
    }

    let pharmacyCount: number | undefined;
    if (pharmacyLogsResult.data) {
      pharmacyCount = new Set(
        (pharmacyLogsResult.data as unknown as VerificationLog[]).map(
          (l) => l.pharmacy_wallet,
        ),
      ).size;
    }

    const expiryDate =
      data.expiry_date ??
      (prescriptionResult.data
        ? (prescriptionResult.data as unknown as PrescriptionRow).expiry_date
        : undefined);

    const fraudContext: FraudContext = {
      reason: fraudReason,
      doctorName,
      patientId: data.patient_identifier,
      medicine: data.medicine,
      prescriptionCount,
      pharmacyCount,
      maxAllowed: fraudReason === "doctor_daily_limit_exceeded" ? 30 : 3,
      expiryDate,
    };

    const explanation = await generateFraudExplanation(fraudContext);

    const { data: alertRaw, error: alertError } = await supabase
      .from("fraud_alerts" as never)
      .insert({
        prescription_hash: data.prescription_hash ?? null,
        doctor_id: doctorId ?? null,
        patient_identifier: data.patient_identifier ?? null,
        pharmacy_wallet: data.pharmacy_wallet,
        reason: fraudReason,
        severity: explanation.severity,
        ai_explanation: explanation.explanation,
        action_required: explanation.actionRequired,
        smart_contract_response: data.smart_contract_response ?? null,
        resolved: false,
      } as never)
      .select()
      .single();

    if (alertError || !alertRaw) {
      console.error("[fraud-check/POST] Insert error:", alertError);
      return ok({
        stored: false,
        fraud_reason: fraudReason,
        severity: explanation.severity,
        explanation: explanation.explanation,
        action_required: explanation.actionRequired,
        warning: "Alert could not be stored but explanation was generated.",
      });
    }

    const alert = alertRaw as Record<string, unknown>;

    if (data.prescription_hash) {
      await supabase.from("verification_logs" as never).insert({
        prescription_hash: data.prescription_hash,
        pharmacy_wallet: data.pharmacy_wallet,
        verified: false,
        fraud_alert_id: alert.id,
        smart_contract_response: data.smart_contract_response ?? null,
      } as never);
    }

    return ok({
      stored: true,
      alert_id: alert.id,
      fraud_reason: fraudReason,
      severity: explanation.severity,
      explanation: explanation.explanation,
      action_required: explanation.actionRequired,
    });
  } catch (err) {
    console.error("[fraud-check/POST] Unexpected error:", err);
    return serverError();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();
    if (!["pharmacist", "regulator"].includes(userRole)) {
      return forbidden(
        "Only pharmacists and regulators can view fraud alerts.",
      );
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = paginate(searchParams);
    const resolved = searchParams.get("resolved");
    const severity = searchParams.get("severity");

    let query = supabase
      .from("fraud_alerts" as never)
      .select(
        `id, prescription_hash, patient_identifier, pharmacy_wallet,
         reason, severity, ai_explanation, action_required,
         resolved, resolved_at, resolution_notes, created_at,
         doctors(full_name, license_number, wallet_address)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (resolved !== null && resolved !== "") {
      query = query.eq("resolved", resolved === "true");
    }
    if (severity) {
      query = query.eq("severity", severity);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[fraud-check/GET]:", error);
      return serverError("Failed to fetch fraud alerts.");
    }

    return paginatedOk((data as unknown[]) ?? [], count ?? 0, page, limit);
  } catch (err) {
    console.error("[fraud-check/GET] Unexpected error:", err);
    return serverError();
  }
}
