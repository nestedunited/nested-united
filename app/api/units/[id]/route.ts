import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET single unit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select(`
      *,
      platform_account:platform_accounts(*),
      unit_calendars(*),
      reservations(*),
      maintenance_tickets(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT update unit
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/units", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية التعديل" }, { status: 403 });
  }

  const body = await request.json();
  const { unit_name, unit_code, city, address, capacity, status } = body;

  // Get unit name before update for logging
  const { data: oldUnit } = await supabase
    .from("units")
    .select("unit_name")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("units")
    .update({ unit_name, unit_code, city, address, capacity, status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "update",
    page_path: "/dashboard/units",
    resource_type: "unit",
    resource_id: id,
    description: `تحديث وحدة: ${oldUnit?.unit_name || unit_name}`,
    metadata: { unit_name, unit_id: id },
  });

  return NextResponse.json(data);
}

// DELETE unit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/units", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الحذف" }, { status: 403 });
  }

  // Get unit name before delete for logging
  const { data: unit } = await supabase
    .from("units")
    .select("unit_name")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "delete",
    page_path: "/dashboard/units",
    resource_type: "unit",
    resource_id: id,
    description: `حذف وحدة: ${unit?.unit_name || id}`,
    metadata: { unit_id: id, unit_name: unit?.unit_name },
  });

  return NextResponse.json({ success: true });
}






