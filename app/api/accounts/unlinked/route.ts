import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// GET platform accounts that are NOT linked to any browser account
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all platform accounts
  const { data: platformAccounts, error: platformError } = await supabase
    .from("platform_accounts")
    .select("id, platform, account_name")
    .order("created_at", { ascending: false });

  if (platformError) {
    return NextResponse.json({ error: platformError.message }, { status: 500 });
  }

  // Get all browser accounts with platform_account_id
  const { data: browserAccounts, error: browserError } = await supabase
    .from("browser_accounts")
    .select("platform_account_id")
    .not("platform_account_id", "is", null);

  if (browserError) {
    return NextResponse.json({ error: browserError.message }, { status: 500 });
  }

  // Filter out linked accounts
  const linkedIds = new Set(browserAccounts?.map(ba => ba.platform_account_id) || []);
  const unlinkedAccounts = platformAccounts?.filter(pa => !linkedIds.has(pa.id)) || [];

  return NextResponse.json(unlinkedAccounts);
}




