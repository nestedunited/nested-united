import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logActivityInServer } from "@/lib/permissions";

export async function POST(
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

  // Get current user status and name
  const { data: targetUser } = await supabase
    .from("users")
    .select("is_active, name")
    .eq("id", id)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const newStatus = !targetUser.is_active;

  // Toggle status
  const { error } = await supabase
    .from("users")
    .update({ is_active: newStatus })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "update",
    page_path: "/dashboard/users",
    resource_type: "user",
    resource_id: id,
    description: `${newStatus ? "تفعيل" : "تعطيل"} المستخدم: ${targetUser.name}`,
    metadata: { user_id: id, is_active: newStatus },
  });

  return NextResponse.json({ success: true, is_active: newStatus });
}





