import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// GET /api/units/readiness - Get all units with their readiness status
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    let query = supabase
      .from("units")
      .select(`
        *,
        platform_account:platform_accounts(id, platform, account_name),
        readiness:unit_status(*)
      `)
      .eq("status", "active")
      .order("unit_name");

    const { data: units, error } = await query;

    if (error) {
      console.error("Error fetching units with readiness:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by status if provided
    let filteredUnits = units || [];
    if (statusFilter) {
      filteredUnits = filteredUnits.filter(
        (unit: any) => unit.readiness?.status === statusFilter
      );
    }

    return NextResponse.json(filteredUnits);
  } catch (error: any) {
    console.error("Error in GET /api/units/readiness:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



