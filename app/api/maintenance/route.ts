import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all maintenance tickets
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select(`
      *,
      unit:units(unit_name),
      created_by_user:users(name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new maintenance ticket
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const supabaseService = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { unit_id, title, description, priority } = body;

  if (!unit_id || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get unit name for notification
  const { data: unit } = await supabase
    .from("units")
    .select("unit_name")
    .eq("id", unit_id)
    .single();

  // Create ticket
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      unit_id,
      title,
      description,
      priority,
      status: "open",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get all active maintenance workers
  const { data: workers } = await supabaseService
    .from("users")
    .select("id")
    .eq("role", "maintenance_worker")
    .eq("is_active", true);

  // Create notifications for all maintenance workers
  if (workers && workers.length > 0) {
    const notifications = workers.map((worker) => ({
      type: "maintenance_created",
      unit_id,
      maintenance_ticket_id: data.id,
      title: "تذكرة صيانة جديدة لك",
      body: `تم إنشاء تذكرة صيانة جديدة: ${title} - الوحدة: ${unit?.unit_name || "غير محدد"}. يمكنك قبولها من صفحة الصيانة.`,
      audience: "all_users" as const,
      recipient_user_id: worker.id,
      is_read: false,
    }));

    await supabaseService
      .from("notifications")
      .insert(notifications);
  }

  // Also create notification for all admins (but only if they're not the creator)
  const { data: admins } = await supabaseService
    .from("users")
    .select("id")
    .in("role", ["admin", "super_admin"])
    .eq("is_active", true)
    .neq("id", user.id); // Don't notify the creator

  if (admins && admins.length > 0) {
    const adminNotifications = admins.map((admin) => ({
      type: "maintenance_created",
      unit_id,
      maintenance_ticket_id: data.id,
      title: "تذكرة صيانة جديدة",
      body: `تم إنشاء تذكرة صيانة جديدة: ${title} - الوحدة: ${unit?.unit_name || "غير محدد"}`,
      audience: "all_admins" as const,
      recipient_user_id: admin.id,
      is_read: false,
    }));

    await supabaseService
      .from("notifications")
      .insert(adminNotifications);
  }

  return NextResponse.json(data, { status: 201 });
}




