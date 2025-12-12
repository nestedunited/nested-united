import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET single browser account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("browser_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH update browser account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission using new permission system
  const hasPermission = await checkUserPermission(user.id, "/dashboard/browser-accounts", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية التعديل" }, { status: 403 });
  }

  // Get account before update for logging
  const { data: oldAccount } = await supabase
    .from("browser_accounts")
    .select("account_name, platform")
    .eq("id", id)
    .single();

  const body = await request.json();

  const { error } = await supabase
    .from("browser_accounts")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: user.id,
    action_type: "update",
    page_path: "/dashboard/browser-accounts",
    resource_type: "browser_account",
    resource_id: id,
    description: `تحديث حساب متصفح: ${oldAccount?.account_name || id}`,
    metadata: { account_id: id },
  });

  return NextResponse.json({ success: true });
}

// DELETE browser account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission using new permission system
  const hasPermission = await checkUserPermission(user.id, "/dashboard/browser-accounts", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الحذف" }, { status: 403 });
  }

  // Get account before delete for logging
  const { data: account } = await supabase
    .from("browser_accounts")
    .select("account_name, platform")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("browser_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: user.id,
    action_type: "delete",
    page_path: "/dashboard/browser-accounts",
    resource_type: "browser_account",
    resource_id: id,
    description: `حذف حساب متصفح: ${account?.account_name || id}`,
    metadata: { account_id: id },
  });

  return NextResponse.json({ success: true });
}


