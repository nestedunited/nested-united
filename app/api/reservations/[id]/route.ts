import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";

// GET /api/reservations/[id] - Get single reservation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      unit:units(id, unit_name, platform_account_id)
    `)
    .eq("id", resolvedParams.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/reservations/[id] - Delete reservation (iCal)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || !isAdmin(currentUser)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", resolvedParams.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
