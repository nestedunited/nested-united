import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all units
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select(`
      *,
      platform_account:platform_accounts(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new unit
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { platform_account_id, unit_name, unit_code, city, address, capacity, status } = body;

  if (!platform_account_id || !unit_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("units")
    .insert({
      platform_account_id,
      unit_name,
      unit_code,
      city,
      address,
      capacity,
      status: status || "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}




