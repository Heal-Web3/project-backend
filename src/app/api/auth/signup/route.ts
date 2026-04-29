import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  created,
  conflict,
  badRequest,
  serverError,
  parseBody,
} from "@/lib/response";
import { signUpSchema as signupSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, signupSchema);
    if ("error" in parsed) return parsed.error;

    const { email, password, role, display_name } = parsed.data;
    const supabase = createServiceClient();

    // Check if email already registered
    const { data: existing } = await supabase
      .from("user_profiles" as never)
      .select("id")
      .eq("email" as never, email)
      .maybeSingle();

    // We check auth.users via signUp — Supabase returns a clear error for duplicates
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, display_name },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("already registered") ||
        error.message.toLowerCase().includes("already exists")
      ) {
        return conflict("An account with this email already exists.");
      }
      console.error("[auth/signup/POST] Create user error:", error);
      return serverError("Failed to create account. Please try again.");
    }

    if (!data.user) return serverError("User creation returned no data.");

    // Upsert user profile
    const { error: profileError } = await supabase
      .from("user_profiles" as never)
      .upsert({
        id: data.user.id,
        role,
        display_name: display_name ?? null,
      } as never);

    if (profileError) {
      console.error("[auth/signup/POST] Profile upsert error:", profileError);
      // Non-fatal — user was created, profile can be set later
    }

    return created({
      user_id: data.user.id,
      email: data.user.email,
      role,
      message: "Account created successfully.",
    });
  } catch (err) {
    console.error("[auth/signup/POST] Unexpected error:", err);
    return serverError();
  }
}
