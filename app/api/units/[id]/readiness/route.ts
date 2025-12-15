import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";

// GET /api/units/[id]/readiness - Get readiness status for a specific unit
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("units")
      .select(
        `
        id,
        readiness_status,
        readiness_checkout_date,
        readiness_checkin_date,
        readiness_guest_name,
        readiness_notes,
        readiness_updated_by,
        readiness_updated_at
        `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching unit readiness:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch unit readiness", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json(data || null);
  } catch (error: any) {
    console.error("Error in GET /api/units/[id]/readiness:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error fetching unit readiness" },
      { status: 500 }
    );
  }
}

// PUT /api/units/[id]/readiness - Update readiness status for a unit
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Use service client to bypass RLS for this privileged operation
    const supabase = createServiceClient();
    const currentUser = await getCurrentUser();

    // Admins + عمال الصيانة يمكنهم تعديل جاهزية الوحدات
    if (
      !currentUser ||
      !(
        isAdmin(currentUser) ||
        currentUser.role === "maintenance_worker"
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, checkout_date, checkin_date, guest_name, notes } = body;

    // Validate status
    const validStatuses = [
      "checkout_today",
      "checkin_today",
      "guest_not_checked_out",
      "awaiting_cleaning",
      "cleaning_in_progress",
      "ready",
      "occupied",
      "booked",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Check if unit exists and get readiness_group_id if any
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id, readiness_group_id")
      .eq("id", id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Prepare common payload
    const payload = {
      readiness_status: status,
      readiness_checkout_date: checkout_date || null,
      readiness_checkin_date: checkin_date || null,
      readiness_guest_name: guest_name || null,
      readiness_notes: notes || null,
      readiness_updated_by: currentUser.id,
      readiness_updated_at: new Date().toISOString(),
    };

    let data;
    let error;

    if (unit.readiness_group_id) {
      // If unit is part of a readiness group, update all units in that group
      const { data: groupUnits } = await supabase
        .from("units")
        .select("id")
        .eq("readiness_group_id", unit.readiness_group_id);

      const idsToUpdate = (groupUnits || []).map((u: any) => u.id);

      const updateResult = await supabase
        .from("units")
        .update(payload)
        .in("id", idsToUpdate)
        .select();

      data = updateResult.data?.[0] || null;
      error = updateResult.error;
    } else {
      // Otherwise, update this unit only
      const updateResult = await supabase
        .from("units")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      data = updateResult.data;
      error = updateResult.error;
    }

    if (error) {
      console.error("Error updating unit readiness:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update status", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in PUT /api/units/[id]/readiness:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error updating unit readiness" },
      { status: 500 }
    );
  }
}

