import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";

// POST /api/unit-readiness/unmerge
// Body:
// - { group_id: string } لفك دمج كل وحدات المجموعة
// - أو { unit_ids: string[] } لفك دمج وحدات محددة فقط
export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const supabase = createServiceClient();

    const body = await request.json().catch(() => null);
    const groupId: string | undefined = body?.group_id || undefined;
    const unitIds: string[] | undefined = body?.unit_ids;

    if (!groupId && (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0)) {
      return NextResponse.json(
        { error: "يجب إرسال group_id أو قائمة unit_ids" },
        { status: 400 }
      );
    }

    let query = supabase.from("units").update({
      readiness_group_id: null,
    });

    if (unitIds && unitIds.length > 0) {
      query = query.in("id", unitIds);
    } else if (groupId) {
      query = query.eq("readiness_group_id", groupId);
    }

    const { error } = await query;

    if (error) {
      console.error("Error unmerging units:", error);
      return NextResponse.json(
        { error: error.message || "فشل فك دمج الوحدات" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in POST /api/unit-readiness/unmerge:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error unmerging units" },
      { status: 500 }
    );
  }
}


