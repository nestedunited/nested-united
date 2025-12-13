import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logActivityInServer } from "@/lib/permissions";

// Get user permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Get user permissions
  const { data, error } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("user_id", id)
    .order("page_path");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ permissions: data || [] });
}

// Update user permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const body = await request.json();
  const { permissions } = body; // Array of { page_path, can_view, can_edit }

  if (!Array.isArray(permissions)) {
    return NextResponse.json({ error: "Invalid permissions format" }, { status: 400 });
  }

  // Delete existing permissions for this user
  const { error: deleteError } = await supabase
    .from("user_permissions")
    .delete()
    .eq("user_id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Get target user name for logging
  const { data: targetUser } = await supabase
    .from("users")
    .select("name")
    .eq("id", id)
    .single();

  // Insert new permissions
  if (permissions.length > 0) {
    const permissionsToInsert = permissions.map((p: any) => ({
      user_id: id,
      page_path: p.page_path,
      can_view: p.can_view || false,
      can_edit: p.can_edit || false,
    }));

    const { error: insertError } = await supabase
      .from("user_permissions")
      .insert(permissionsToInsert);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "update",
    page_path: "/dashboard/users",
    resource_type: "user_permissions",
    resource_id: id,
    description: `تحديث صلاحيات المستخدم: ${targetUser?.name || id}`,
    metadata: { user_id: id, permissions_count: permissions.length },
  });

  return NextResponse.json({ success: true });
}

