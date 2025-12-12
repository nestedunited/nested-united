import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT update account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/accounts", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية التعديل" }, { status: 403 });
  }

  const body = await request.json();
  const { account_name, notes } = body;

  // Get account before update for logging
  const { data: oldAccount } = await supabase
    .from("platform_accounts")
    .select("account_name, platform")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("platform_accounts")
    .update({ account_name, notes })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "update",
    page_path: "/dashboard/accounts",
    resource_type: "account",
    resource_id: id,
    description: `تحديث حساب: ${oldAccount?.account_name || account_name}`,
    metadata: { account_id: id, account_name },
  });

  return NextResponse.json(data);
}

// DELETE account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/accounts", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الحذف" }, { status: 403 });
  }

  // Get account before delete for logging
  const { data: account } = await supabase
    .from("platform_accounts")
    .select("account_name, platform")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("platform_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "delete",
    page_path: "/dashboard/accounts",
    resource_type: "account",
    resource_id: id,
    description: `حذف حساب: ${account?.account_name || id}`,
    metadata: { account_id: id },
  });

  return NextResponse.json({ success: true });
}






