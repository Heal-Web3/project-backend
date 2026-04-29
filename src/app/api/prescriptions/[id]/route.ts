import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ok,
  notFound,
  forbidden,
  unauthorized,
  conflict,
  serverError,
  parseBody,
} from "@/lib/response";
import { fillPrescriptionSchema } from "@/lib/schemas";

type PrescriptionStatus = { status: string };

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
      .from("prescriptions" as never)
      .select(
        `id, prescription_hash, patient_identifier, medicine, dosage, issued_at, expiry_date, status, filled_at, filled_by_pharmacy, chain_verified,
         doctors(id, full_name, license_number, specialty, wallet_address)`
      )
      .eq("id", id)
      .single();

    if (error || !data) return notFound("Prescription");
    return ok(data as Record<string, unknown>);
  } catch (err) {
    console.error("[prescriptions/[id]/GET] Unexpected error:", err);
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

    if (!["pharmacist", "regulator"].includes(userRole)) {
      return forbidden("Only pharmacists can mark prescriptions as filled.");
    }

    const { id } = await params;
    const parsed = await parseBody(request, fillPrescriptionSchema);
    if ("error" in parsed) return parsed.error;

    const supabase = createServiceClient();
    const { data: prescriptionRaw } = await supabase
      .from("prescriptions" as never)
      .select("status")
      .eq("id", id)
      .single();

    if (!prescriptionRaw) return notFound("Prescription");
    const prescription = prescriptionRaw as unknown as PrescriptionStatus;

    if (prescription.status === "filled") {
      return ok({ message: "Prescription has already been filled." });
    }

    // Wrong status is a state conflict, not a permissions error — use 409
    if (prescription.status !== "active") {
      return conflict(
        `Cannot fill a prescription with status: ${prescription.status}.`
      );
    }

    const { data, error } = await supabase
      .from("prescriptions" as never)
      .update({
        status: "filled",
        filled_at: new Date().toISOString(),
        filled_by_pharmacy: parsed.data.pharmacy_wallet,
        chain_verified: parsed.data.chain_verified ?? true,
      } as never)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return serverError("Failed to update prescription status.");
    return ok(data as Record<string, unknown>);
  } catch (err) {
    console.error("[prescriptions/[id]/PATCH] Unexpected error:", err);
    return serverError();
  }
}
