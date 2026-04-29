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
import { revokeDoctorSchema } from "@/lib/schemas";

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
      .from("doctors")
      .select(
        "id, wallet_address, license_number, full_name, specialty, nft_token_id, is_active, registered_at, revoked_at, revoked_by"
      )
      .eq("id", id)
      .single();

    if (error || !data) return notFound("Doctor");
    return ok(data as Record<string, unknown>);
  } catch (err) {
    console.error("[doctors/[id]/GET] Unexpected error:", err);
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

    if (!userId || !userRole) return unauthorized(); // 401, not 403

    if (userRole !== "regulator") {
      return forbidden("Only regulators can revoke doctor licenses.");
    }

    const { id } = await params;
    const parsed = await parseBody(request, revokeDoctorSchema);
    if ("error" in parsed) return parsed.error;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("doctors")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
      } as never)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return notFound("Doctor");
    const doctor = data as Record<string, unknown>;
    return ok({
      ...doctor,
      message: `License for ${doctor.full_name} has been revoked.`,
    });
  } catch (err) {
    console.error("[doctors/[id]/PATCH] Unexpected error:", err);
    return serverError();
  }
}
