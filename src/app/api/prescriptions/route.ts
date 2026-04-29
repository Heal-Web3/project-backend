import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ok,
  created,
  conflict,
  forbidden,
  unauthorized,
  notFound,
  badRequest,
  serverError,
  parseBody,
  paginatedOk,
  paginate,
} from "@/lib/response";
import { submitPrescriptionSchema } from "@/lib/schemas";

type DoctorRow = { id: string; is_active: boolean; full_name: string };
type DoctorId = { id: string };
type PrescriptionRow = { id: string; prescription_hash: string };

export async function POST(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();
    if (userRole !== "doctor") {
      return forbidden("Only doctors can submit prescriptions.");
    }

    const parsed = await parseBody(request, submitPrescriptionSchema);
    if ("error" in parsed) return parsed.error;

    const data = parsed.data;
    const supabase = createServiceClient();

    const { data: doctorRaw, error: doctorError } = await supabase
      .from("doctors" as never)
      .select("id, is_active, full_name")
      .eq("wallet_address", data.doctor_wallet)
      .eq("user_id", userId)
      .single();

    if (doctorError || !doctorRaw) {
      return notFound("Doctor record for this wallet address");
    }

    const doctor = doctorRaw as unknown as DoctorRow;

    if (!doctor.is_active) {
      return forbidden(
        "Your doctor license has been revoked. You cannot issue prescriptions."
      );
    }

    const { data: existing } = await supabase
      .from("prescriptions" as never)
      .select("id")
      .eq("prescription_hash", data.prescription_hash)
      .single();

    if (existing) {
      return conflict("A prescription with this hash already exists.");
    }

    // Expiry date in the past is a client error — 400, not 500
    if (new Date(data.expiry_date) <= new Date()) {
      return badRequest("Expiry date must be in the future.");
    }

    const { data: prescriptionRaw, error: insertError } = await supabase
      .from("prescriptions" as never)
      .insert({
        prescription_hash: data.prescription_hash,
        doctor_id: doctor.id,
        patient_identifier: data.patient_identifier,
        medicine: data.medicine,
        dosage: data.dosage,
        expiry_date: data.expiry_date,
        signature: data.signature,
        nft_doctor_id: data.nft_doctor_id,
        status: "active",
        chain_verified: false,
      } as never)
      .select()
      .single();

    if (insertError || !prescriptionRaw) {
      console.error("[prescriptions/POST] Insert error:", insertError);
      return serverError("Failed to save prescription. Please try again.");
    }

    const prescription = prescriptionRaw as unknown as PrescriptionRow;

    return created({
      prescription_id: prescription.id,
      prescription_hash: prescription.prescription_hash,
      message: `Prescription for ${data.medicine} submitted successfully.`,
    });
  } catch (err) {
    console.error("[prescriptions/POST] Unexpected error:", err);
    return serverError();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = paginate(searchParams);
    const status = searchParams.get("status");

    let query = supabase
      .from("prescriptions" as never)
      .select(
        `id, prescription_hash, patient_identifier, medicine, dosage,
         issued_at, expiry_date, status, filled_at, filled_by_pharmacy, chain_verified,
         doctors(full_name, license_number, specialty, wallet_address)`,
        { count: "exact" }
      )
      .order("issued_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userRole === "doctor") {
      const { data: doctorRaw } = await supabase
        .from("doctors" as never)
        .select("id")
        .eq("user_id", userId)
        .single();
      if (!doctorRaw) return ok([], { total: 0, page, limit, pages: 0 });
      const doc = doctorRaw as unknown as DoctorId;
      query = query.eq("doctor_id", doc.id);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[prescriptions/GET]:", error);
      return serverError("Failed to fetch prescriptions.");
    }

    return paginatedOk((data as unknown[]) ?? [], count ?? 0, page, limit);
  } catch (err) {
    console.error("[prescriptions/GET] Unexpected error:", err);
    return serverError();
  }
}
