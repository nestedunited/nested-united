import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user is a maintenance worker
  if (user.role !== "maintenance_worker") {
    return NextResponse.json({ error: "Only maintenance workers can accept tickets" }, { status: 403 });
  }

  // Get the ticket with a check to prevent race conditions
  const { data: ticket, error: fetchError } = await supabase
    .from("maintenance_tickets")
    .select("assigned_to, accepted_at, status")
    .eq("id", id)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Ticket must be open
  if (ticket.status !== "open") {
    return NextResponse.json({ error: "Only open tickets can be accepted" }, { status: 400 });
  }

  // If ticket is already accepted by someone else, reject
  if (ticket.accepted_at) {
    return NextResponse.json({ error: "تم قبول هذه التذكرة بالفعل من قبل عامل آخر" }, { status: 400 });
  }

  // If ticket is assigned to someone else, reject
  if (ticket.assigned_to && ticket.assigned_to !== user.id) {
    return NextResponse.json({ error: "هذه التذكرة معينة لعامل آخر" }, { status: 403 });
  }

  // Accept the ticket using a conditional update to prevent race conditions
  // Only update if accepted_at is still null
  const { data: updatedTicket, error: updateError } = await supabase
    .from("maintenance_tickets")
    .update({
      assigned_to: user.id,
      accepted_at: new Date().toISOString(),
      status: "in_progress",
    })
    .eq("id", id)
    .is("accepted_at", null) // Only update if not already accepted
    .select()
    .single();

  if (updateError || !updatedTicket) {
    // Check if it was because ticket was already accepted
    const { data: checkTicket } = await supabase
      .from("maintenance_tickets")
      .select("accepted_at, assigned_to")
      .eq("id", id)
      .single();

    if (checkTicket?.accepted_at) {
      return NextResponse.json({ 
        error: "تم قبول هذه التذكرة بالفعل من قبل عامل آخر" 
      }, { status: 400 });
    }

    return NextResponse.json({ error: updateError?.message || "فشل قبول التذكرة" }, { status: 500 });
  }

  // Get ticket and unit info for notification
  const supabaseService = await createServiceClient();
  const { data: ticketInfo } = await supabaseService
    .from("maintenance_tickets")
    .select("title, unit_id")
    .eq("id", id)
    .single();

  // Get unit name
  let unitName = "غير محدد";
  if (ticketInfo?.unit_id) {
    const { data: unitData } = await supabaseService
      .from("units")
      .select("unit_name")
      .eq("id", ticketInfo.unit_id)
      .single();
    if (unitData) {
      unitName = unitData.unit_name;
    }
  }

  // Get user name
  const { data: userInfo } = await supabaseService
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  // Create notification for admins about ticket acceptance
  if (ticketInfo) {
    const { data: admins } = await supabaseService
      .from("users")
      .select("id")
      .in("role", ["admin", "super_admin"])
      .eq("is_active", true);

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        type: "maintenance_status_changed",
        unit_id: ticketInfo.unit_id,
        maintenance_ticket_id: id,
        title: "تم قبول تذكرة صيانة",
        body: `تم قبول تذكرة الصيانة "${ticketInfo.title}" من قبل ${userInfo?.name || "عامل صيانة"} - الوحدة: ${unitName}`,
        audience: "all_admins" as const,
        recipient_user_id: admin.id,
        is_read: false,
      }));

      await supabaseService
        .from("notifications")
        .insert(notifications);
    }
  }

  return NextResponse.json({ success: true });
}


