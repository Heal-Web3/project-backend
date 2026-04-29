import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { ok, notFound, unauthorized, serverError, parseBody } from "@/lib/response";
import { updateProfileSchema } from "@/lib/schemas";

type UserProfile = {
  id: string;
  role: string;
  display_name: string | null;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();

    const supabase = createServiceClient();

    const { data: profileRaw, error } = await supabase
      .from("user_profiles" as never)
      .select("id, role, display_name, wallet_address, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error || !profileRaw) return notFound("User profile");

    const profile = profileRaw as unknown as UserProfile;

    let doctorRecord = null;
    if (profile.role === "doctor") {
      const { data: doctor } = await supabase
        .from("doctors" as never)
        .select(
          "id, wallet_address, license_number, full_name, specialty, nft_token_id, is_active, registered_at"
        )
        .eq("user_id", userId)
        .single();
      doctorRecord = (doctor as unknown) ?? null;
    }

    return ok({
      ...profile,
      doctor: doctorRecord,
    });
  } catch (err) {
    console.error("[me/GET] Unexpected error:", err);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    if (!userId) return unauthorized();

    const parsed = await parseBody(request, updateProfileSchema);
    if ("error" in parsed) return parsed.error;

    const updates = parsed.data;
    if (!updates.display_name && !updates.wallet_address) {
      return ok({ message: "No changes provided." });
    }

    const supabase = createServiceClient();

    const { data: profile, error } = await supabase
      .from("user_profiles" as never)
      .update(updates as never)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("[me/PATCH] Update error:", error);
      return serverError("Failed to update profile.");
    }

    return ok(profile as unknown as Record<string, unknown>);
  } catch (err) {
    console.error("[me/PATCH] Unexpected error:", err);
    return serverError();
  }
}
