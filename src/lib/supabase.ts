import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

export function getSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createServiceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await getSupabaseClient().auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function getUserProfile(userId: string): Promise<{
  id: string;
  role: string;
  display_name?: string | null;
  wallet_address?: string | null;
} | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("user_profiles")
    .select("id, role, display_name, wallet_address")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data as {
    id: string;
    role: string;
    display_name?: string | null;
    wallet_address?: string | null;
  };
}
