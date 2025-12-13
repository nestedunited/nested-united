import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Get activity logs (super admin only)
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check if current user is super admin
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (currentUser?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;
  const fromDate = searchParams.get("from_date");

  let query = supabase
    .from("user_activity_logs")
    .select(`
      *,
      user:users!user_activity_logs_user_id_fkey(id, name, email)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Only show logs from last 30 days (default)
  if (fromDate) {
    query = query.gte("created_at", fromDate);
  } else {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte("created_at", thirtyDaysAgo.toISOString());
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

// Create activity log
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    action_type,
    page_path,
    resource_type,
    resource_id,
    description,
    metadata,
  } = body;

  // Get IP and user agent from headers
  const ipAddress = request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const { error } = await supabase
    .from("user_activity_logs")
    .insert({
      user_id: authUser.id,
      action_type,
      page_path,
      resource_type,
      resource_id,
      description,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

