import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET /api/bookings/[id] - Get single booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", resolvedParams.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/bookings/[id] - Update booking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(currentUser.id, "/dashboard/bookings", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية التعديل" }, { status: 403 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;
  const body = await request.json();
  const {
    unit_id,
    platform_account_id,
    platform,
    guest_name,
    phone,
    checkin_date,
    checkout_date,
    amount,
    currency,
    notes,
  } = body;

  if (!guest_name || !checkin_date || !checkout_date || !unit_id) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Get booking before update for logging
  const { data: oldBooking } = await supabase
    .from("bookings")
    .select("guest_name")
    .eq("id", resolvedParams.id)
    .single();

  const { data, error } = await supabase
    .from("bookings")
    .update({
      unit_id,
      platform_account_id: platform_account_id || null,
      platform: platform || null,
      guest_name,
      phone: phone || null,
      checkin_date,
      checkout_date,
      amount: amount || null,
      currency: currency || "SAR",
      notes: notes || null,
    })
    .eq("id", resolvedParams.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: currentUser.id,
    action_type: "update",
    page_path: "/dashboard/bookings",
    resource_type: "booking",
    resource_id: resolvedParams.id,
    description: `تحديث حجز: ${oldBooking?.guest_name || guest_name}`,
    metadata: { booking_id: resolvedParams.id, guest_name },
  });

  return NextResponse.json(data);
}

// DELETE /api/bookings/[id] - Delete booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(currentUser.id, "/dashboard/bookings", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الحذف" }, { status: 403 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;

  // Get booking before delete for logging
  const { data: booking } = await supabase
    .from("bookings")
    .select("guest_name")
    .eq("id", resolvedParams.id)
    .single();

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: currentUser.id,
    action_type: "delete",
    page_path: "/dashboard/bookings",
    resource_type: "booking",
    resource_id: resolvedParams.id,
    description: `حذف حجز: ${booking?.guest_name || resolvedParams.id}`,
    metadata: { booking_id: resolvedParams.id },
  });

  return NextResponse.json({ success: true });
}

