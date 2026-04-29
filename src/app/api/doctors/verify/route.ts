import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
  getUserFromRequest,
  getUserProfile,
} from "@/lib/supabase";

type Doctor = {
  id: string;
  wallet_address: string;
  license_number: string;
  full_name: string;
  specialty: string;
  nft_token_id: string | null;
  is_active: boolean;
  registered_at: string;
  revoked_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    const nftTokenId = searchParams.get("nft_token_id");

    if (!wallet && !nftTokenId) {
      return NextResponse.json(
        { error: "Provide either 'wallet' or 'nft_token_id' query param." },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    let query = supabase
      .from("doctors" as never)
      .select(
        "id, wallet_address, license_number, full_name, specialty, nft_token_id, is_active, registered_at, revoked_at",
      );

    if (wallet) {
      query = query.eq("wallet_address", wallet);
    } else if (nftTokenId) {
      query = query.eq("nft_token_id", nftTokenId);
    }

    const { data: doctorRaw, error } = await query.single();

    if (error || !doctorRaw) {
      return NextResponse.json(
        {
          verified: false,
          reason: "Doctor not found in the verified registry.",
        },
        { status: 404 },
      );
    }

    const doctor = doctorRaw as unknown as Doctor;

    if (!doctor.is_active) {
      return NextResponse.json({
        verified: false,
        reason: "Doctor license has been revoked.",
        doctor: {
          full_name: doctor.full_name,
          license_number: doctor.license_number,
          revoked_at: doctor.revoked_at,
        },
      });
    }

    return NextResponse.json({
      verified: true,
      doctor: {
        id: doctor.id,
        full_name: doctor.full_name,
        license_number: doctor.license_number,
        specialty: doctor.specialty,
        wallet_address: doctor.wallet_address,
        nft_token_id: doctor.nft_token_id,
        registered_at: doctor.registered_at,
      },
    });
  } catch (error) {
    console.error("[doctors/verify/GET] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
