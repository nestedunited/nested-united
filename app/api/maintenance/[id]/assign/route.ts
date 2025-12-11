import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const supabaseService = await createServiceClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can assign
  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { worker_id } = body;

  if (!worker_id) {
    return NextResponse.json({ error: "Worker ID required" }, { status: 400 });
  }

  // Verify the worker exists and is a maintenance_worker
  const { data: worker } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", worker_id)
    .eq("role", "maintenance_worker")
    .eq("is_active", true)
    .single();

  if (!worker) {
    return NextResponse.json({ error: "Invalid worker" }, { status: 400 });
  }

  // Get ticket info
  const { data: ticket } = await supabase
    .from("maintenance_tickets")
    .select("title, unit_id")
    .eq("id", id)
    .single();

  // Get unit name
  let unitName = "غير محدد";
  if (ticket?.unit_id) {
    const { data: unitData } = await supabaseService
      .from("units")
      .select("unit_name")
      .eq("id", ticket.unit_id)
      .single();
    if (unitData) {
      unitName = unitData.unit_name;
    }
  }

  // Assign the ticket
  const { error } = await supabase
    .from("maintenance_tickets")
    .update({
      assigned_to: worker_id,
      accepted_at: null, // Reset acceptance when reassigning
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create notification for the assigned worker
  if (ticket) {
    await supabaseService
      .from("notifications")
      .insert({
        type: "maintenance_created",
        unit_id: ticket.unit_id,
        maintenance_ticket_id: id,
        title: "تذكرة صيانة جديدة لك",
        body: `تم تعيين تذكرة صيانة للوحدة: ${unitName} إليك`,
        audience: "all_users" as const,
        recipient_user_id: worker_id,
        is_read: false,
      });
  }

  return NextResponse.json({ success: true });
}


