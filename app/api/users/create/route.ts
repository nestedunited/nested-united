import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
  const { email, password, name, role } = body;

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create admin client with service role
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create auth user
  const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Add to users table
  const { error: dbError } = await adminClient
    .from("users")
    .insert({
      id: newAuthUser.user.id,
      email,
      name,
      role,
      is_active: true,
    });

  if (dbError) {
    // Rollback: delete auth user
    await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: newAuthUser.user.id }, { status: 201 });
}




