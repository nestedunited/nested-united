import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET all accounts
export async function GET() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("platform_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new account
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, "/dashboard/accounts", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الإنشاء" }, { status: 403 });
  }

  const body = await request.json();
  const { platform, account_name, notes } = body;

  if (!platform || !account_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("platform_accounts")
    .insert({
      platform,
      account_name,
      notes,
      created_by: authUser.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: authUser.id,
    action_type: "create",
    page_path: "/dashboard/accounts",
    resource_type: "account",
    resource_id: data.id,
    description: `إنشاء حساب جديد: ${account_name} (${platform})`,
    metadata: { account_name, platform },
  });

  return NextResponse.json(data, { status: 201 });
}






