import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkUserPermission, logActivityInServer } from "@/lib/permissions";

// GET all browser accounts
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("browser_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new browser account
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission using new permission system
  const hasPermission = await checkUserPermission(user.id, "/dashboard/browser-accounts", "edit");
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: لا تملك صلاحية الإنشاء" }, { status: 403 });
  }

  const body = await request.json();
  const { platform, account_name, account_email, notes, platform_account_id } = body;

  if (!platform || !account_name) {
    return NextResponse.json({ error: "Platform and account name required" }, { status: 400 });
  }

  // Enforce one-to-one link for non-WhatsApp platforms
  if (platform !== "whatsapp" && platform_account_id) {
    const { data: existingLink } = await supabase
      .from("browser_accounts")
      .select("id, account_name")
      .eq("platform_account_id", platform_account_id)
      .neq("platform", "whatsapp")
      .single();

    if (existingLink) {
      return NextResponse.json(
        { error: `حساب المنصة مرتبط بالفعل بحساب متصفح آخر (${existingLink.account_name})` },
        { status: 400 }
      );
    }
  }

  // Generate unique session partition
  const session_partition = `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const { data, error } = await supabase
    .from("browser_accounts")
    .insert({
      platform,
      account_name,
      account_email,
      notes,
      platform_account_id: platform === "whatsapp" ? null : platform_account_id || null,
      session_partition,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === "23505" && error.message.includes("platform_account_id")) {
      return NextResponse.json(
        { error: "حساب المنصة مرتبط بالفعل بحساب متصفح آخر" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await logActivityInServer({
    userId: user.id,
    action_type: "create",
    page_path: "/dashboard/browser-accounts",
    resource_type: "browser_account",
    resource_id: data.id,
    description: `إنشاء حساب متصفح جديد: ${account_name} (${platform})`,
    metadata: { account_name, platform },
  });

  return NextResponse.json(data, { status: 201 });
}

