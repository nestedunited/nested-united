import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

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

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/units", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الإنشاء" }, { status: 403 });
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

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "create",
    page_path: "/dashboard/units",
    resource_type: "unit",
    resource_id: data.id,
    description: `إنشاء وحدة جديدة: ${unit_name}`,
    metadata: { unit_name, platform_account_id },
  });

  return NextResponse.json(data, { status: 201 });
}






