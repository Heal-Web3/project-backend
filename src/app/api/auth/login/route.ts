import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  ok,
  unauthorized,
  badRequest,
  serverError,
  parseBody,
} from "@/lib/response";
import { signUpSchema } from "@/lib/schemas";

// Login only needs email + password — pick those fields from signUpSchema
const loginSchema = signUpSchema.pick({ email: true, password: true });

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, loginSchema);
    if ("error" in parsed) return parsed.error;

    const { email, password } = parsed.data;
    const supabase = createServiceClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return unauthorized("Invalid email or password.");
    }

    const { data: profileRaw } = await supabase
      .from("user_profiles" as never)
      .select("id, role, display_name, wallet_address")
      .eq("id", data.user.id)
      .single();

    const profile = (profileRaw as unknown as Record<string, unknown>) ?? {};

    return ok({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: "Bearer",
      user: {
        id: data.user.id,
        email: data.user.email,
        ...profile,
      },
    });
  } catch (err) {
    console.error("[auth/login/POST] Unexpected error:", err);
    return serverError();
  }
}
