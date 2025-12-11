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

    if (!currentUser || !isAdmin(currentUser)) {
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
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Check if unit exists
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id")
      .eq("id", id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Upsert unit status
    const { data, error } = await supabase
      .from("units")
      .update({
        readiness_status: status,
        readiness_checkout_date: checkout_date || null,
        readiness_checkin_date: checkin_date || null,
        readiness_guest_name: guest_name || null,
        readiness_notes: notes || null,
        readiness_updated_by: currentUser.id,
        readiness_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

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

