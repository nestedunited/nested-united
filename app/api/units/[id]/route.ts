import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET All Units
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");

  let query = supabase
    .from("units")
    .select(`
      *,
      unit_calendars(count),
      reservations(count)
    `)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST Create Unit (تم التعديل لإضافة التقاويم)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. التحقق من المستخدم
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. التحقق من الصلاحيات
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/units", "create");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية إضافة وحدات" }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    // فصل التقاويم عن بيانات الوحدة
    const { calendars, ...unitData } = body;
    const { unit_name, unit_code, city, address, capacity, status } = unitData;

    if (!unit_name) {
      return NextResponse.json({ error: "اسم الوحدة مطلوب" }, { status: 400 });
    }

    // 3. إضافة الوحدة أولاً (بدون created_by لتجنب الأخطاء)
    const { data: newUnit, error: unitError } = await supabase
      .from("units")
      .insert({
        unit_name,
        unit_code: unit_code || null,
        city: city || null,
        address: address || null,
        capacity: capacity ? Number(capacity) : null,
        status: status || "active",
      })
      .select()
      .single();

    if (unitError) {
      console.error("Error creating unit:", unitError);
      return NextResponse.json({ error: unitError.message }, { status: 500 });
    }

    // 4. إضافة التقاويم (إذا وجدت)
    if (calendars && Array.isArray(calendars) && calendars.length > 0) {
      const calendarsToInsert = calendars.map((cal: any) => ({
        unit_id: newUnit.id, // نربط التقويم بالوحدة الجديدة
        platform: cal.platform,
        ical_url: cal.ical_url,
        is_primary: cal.is_primary || false,
        platform_account_id: cal.platform_account_id || null
      }));

      const { error: calendarError } = await supabase
        .from("unit_calendars")
        .insert(calendarsToInsert);

      if (calendarError) {
        console.error("Error creating calendars:", calendarError);
        // لا نوقف العملية لأن الوحدة تم إنشاؤها بالفعل، لكن نسجل الخطأ
      }
    }

    // 5. تسجيل النشاط
    await logActivityInServer({
      userId: authUser.id,
      action_type: "create",
      page_path: "/dashboard/units",
      resource_type: "unit",
      resource_id: newUnit.id,
      description: `إضافة وحدة جديدة: ${unit_name}`,
      metadata: { unit_name, unit_id: newUnit.id, calendars_count: calendars?.length || 0 },
    });

    return NextResponse.json(newUnit);

  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: "حدث خطأ غير متوقع في السيرفر" }, { status: 500 });
  }
}