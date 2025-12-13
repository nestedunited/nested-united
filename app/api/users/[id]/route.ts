import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logActivityInServer } from "@/lib/permissions";

// GET single user
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

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT update user (name, email, role)
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
  const { name, email, role } = body;

  // Get old user data for logging
  const { data: oldUser } = await supabase
    .from("users")
    .select("name, email, role")
    .eq("id", id)
    .single();

  if (!oldUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Update user in users table
  const updateData: any = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (role) updateData.role = role;

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update email in auth.users if email changed
  if (email && email !== oldUser.email) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, {
      email: email,
    });
    if (authError) {
      console.error("Error updating auth email:", authError);
    }
  }

  // Log activity
  const changes: string[] = [];
  if (name && name !== oldUser.name) changes.push(`الاسم: ${oldUser.name} → ${name}`);
  if (email && email !== oldUser.email) changes.push(`البريد: ${oldUser.email} → ${email}`);
  if (role && role !== oldUser.role) changes.push(`الدور: ${oldUser.role} → ${role}`);

  await logActivityInServer({
    userId: authUser.id,
    action_type: "update",
    page_path: "/dashboard/users",
    resource_type: "user",
    resource_id: id,
    description: `تحديث مستخدم: ${oldUser.name} - ${changes.join(", ")}`,
    metadata: { user_id: id, changes },
  });

  return NextResponse.json(data);
}

// DELETE user
export async function DELETE(
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

  // Prevent deleting yourself
  if (id === authUser.id) {
    return NextResponse.json({ error: "لا يمكنك حذف نفسك" }, { status: 400 });
  }

  // Get user data before delete for logging
  const { data: user } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", id)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete user (cascade will handle related data)
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also delete from auth.users
  try {
    await supabase.auth.admin.deleteUser(id);
  } catch (authError) {
    console.error("Error deleting auth user:", authError);
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "delete",
    page_path: "/dashboard/users",
    resource_type: "user",
    resource_id: id,
    description: `حذف مستخدم: ${user.name} (${user.email})`,
    metadata: { user_id: id, user_name: user.name },
  });

  return NextResponse.json({ success: true });
}


