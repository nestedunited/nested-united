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
      unit_calendars:unit_calendars(
        id,
        platform,
        ical_url,
        is_primary,
        platform_account:platform_accounts(id, account_name, platform)
      )
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
  const { unit_name, unit_code, city, address, capacity, status, calendars } = body;

  if (!unit_name) {
    return NextResponse.json({ error: "اسم الوحدة مطلوب" }, { status: 400 });
  }

  // Create unit (platform_account_id is now optional/nullable)
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .insert({
      unit_name,
      unit_code,
      city,
      address,
      capacity,
      status: status || "active",
      platform_account_id: null, // No longer required
    })
    .select()
    .single();

  if (unitError) {
    return NextResponse.json({ error: unitError.message }, { status: 500 });
  }

  // Create calendars if provided
  if (calendars && Array.isArray(calendars) && calendars.length > 0) {
    const calendarsToInsert = calendars.map((cal: any, index: number) => ({
      unit_id: unit.id,
      platform: cal.platform,
      ical_url: cal.ical_url || "",
      is_primary: cal.is_primary || (index === 0), // First calendar is primary by default
      platform_account_id: cal.platform_account_id || null,
    }));

    const { error: calendarsError } = await supabase
      .from("unit_calendars")
      .insert(calendarsToInsert);

    if (calendarsError) {
      // Rollback unit creation if calendars fail
      await supabase.from("units").delete().eq("id", unit.id);
      return NextResponse.json({ error: `خطأ في إضافة التقاويم: ${calendarsError.message}` }, { status: 500 });
    }
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "create",
    page_path: "/dashboard/units",
    resource_type: "unit",
    resource_id: unit.id,
    description: `إنشاء وحدة جديدة: ${unit_name}`,
    metadata: { unit_name, calendars_count: calendars?.length || 0 },
  });

  return NextResponse.json(unit, { status: 201 });
}






