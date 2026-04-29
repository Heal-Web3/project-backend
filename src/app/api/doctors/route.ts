import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ok,
  created,
  conflict,
  forbidden,
  unauthorized,
  serverError,
  parseBody,
  paginatedOk,
  paginate,
} from "@/lib/response";
import { registerDoctorSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    // Read auth context injected by middleware
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !userRole) return unauthorized();
    if (userRole !== "doctor") {
      return forbidden("Only users with the 'doctor' role can register a doctor profile.");
    }

    const parsed = await parseBody(request, registerDoctorSchema);
    if ("error" in parsed) return parsed.error;

    const data = parsed.data;
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from("doctors" as never)
      .select("id")
      .eq("user_id", userId)
      .single();
    if (existing) return conflict("A doctor record already exists for this account.");

    const { data: walletTaken } = await supabase
      .from("doctors" as never)
      .select("id")
      .eq("wallet_address", data.wallet_address)
      .single();
    if (walletTaken)
      return conflict("This wallet address is already registered to another doctor.");

    const { data: licenseTaken } = await supabase
      .from("doctors" as never)
      .select("id")
      .eq("license_number", data.license_number)
      .single();
    if (licenseTaken) return conflict("This license number is already registered.");

    const { data: doctor, error: insertError } = await supabase
      .from("doctors" as never)
      .insert({
        user_id: userId,
        wallet_address: data.wallet_address,
        license_number: data.license_number,
        full_name: data.full_name,
        specialty: data.specialty,
        nft_token_id: data.nft_token_id ?? null,
        is_active: true,
      } as never)
      .select()
      .single();

    if (insertError || !doctor) {
      console.error("[doctors/POST] Insert error:", insertError);
      return serverError("Failed to register doctor. Please try again.");
    }

    const d = doctor as Record<string, unknown>;
    return created({
      doctor_id: d.id,
      message: `${data.full_name} registered successfully.`,
    });
  } catch (err) {
    console.error("[doctors/POST] Unexpected error:", err);
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
    const search = searchParams.get("search")?.trim();
    const activeOnly = searchParams.get("active_only");

    let query = supabase
      .from("doctors" as never)
      .select(
        "id, wallet_address, license_number, full_name, specialty, nft_token_id, is_active, registered_at, revoked_at",
        { count: "exact" }
      )
      .order("registered_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userRole === "pharmacist" || activeOnly === "true") {
      query = query.eq("is_active", true);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,license_number.ilike.%${search}%,wallet_address.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("[doctors/GET]:", error);
      return serverError("Failed to fetch doctors.");
    }

    return paginatedOk((data as unknown[]) ?? [], count ?? 0, page, limit);
  } catch (err) {
    console.error("[doctors/GET] Unexpected error:", err);
    return serverError();
  }
}
