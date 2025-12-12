import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkUserPermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const pagePath = searchParams.get("page_path");
  const action = searchParams.get("action") as "view" | "edit" | null;

  if (!pagePath || !action) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ hasPermission: false }, { status: 401 });
  }

  const hasPermission = await checkUserPermission(authUser.id, pagePath, action);
  return NextResponse.json({ hasPermission });
}

