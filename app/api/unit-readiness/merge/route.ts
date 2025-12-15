import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";

// POST /api/unit-readiness/merge
// Body: { unit_ids: string[] }
// Makes the selected units share the same readiness_group_id
export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const supabase = createServiceClient();

    const body = await request.json().catch(() => null);
    const unitIds: string[] | undefined = body?.unit_ids;

    if (!unitIds || !Array.isArray(unitIds) || unitIds.length < 2) {
      return NextResponse.json(
        { error: "يجب اختيار وحدتين على الأقل للدمج" },
        { status: 400 }
      );
    }

    // Fetch selected units
    const { data: units, error: fetchError } = await supabase
      .from("units")
      .select("id, readiness_group_id, readiness_status, readiness_checkout_date, readiness_checkin_date, readiness_guest_name, readiness_notes")
      .in("id", unitIds);

    if (fetchError) {
      console.error("Error fetching units for merge:", fetchError);
      return NextResponse.json(
        { error: fetchError.message || "فشل تحميل الوحدات" },
        { status: 500 }
      );
    }

    if (!units || units.length < 2) {
      return NextResponse.json(
        { error: "لم يتم العثور على الوحدات المطلوبة" },
        { status: 404 }
      );
    }

    // Validation: لا نسمح بدمج وحدات من أكثر من مجموعة مختلفة
    const distinctGroupIds = Array.from(
      new Set(
        units
          .map((u: any) => u.readiness_group_id)
          .filter((g: string | null) => g !== null)
      )
    );

    if (distinctGroupIds.length > 1) {
      return NextResponse.json(
        { error: "لا يمكن دمج وحدات تنتمي إلى مجموعات جاهزية مختلفة. رجاء فك الدمج أولاً." },
        { status: 400 }
      );
    }

    // Determine group id:
    // - Use existing readiness_group_id if any unit already has one
    // - Otherwise generate a new UUID in JS
    let groupId =
      (distinctGroupIds[0] as string | undefined) ||
      units.find((u: any) => u.readiness_group_id)?.readiness_group_id ||
      crypto.randomUUID();

    // Choose a "source" unit to copy readiness state from (first one that has status)
    const sourceUnit =
      units.find((u: any) => u.readiness_status) || units[0];

    const updatePayload = {
      readiness_group_id: groupId,
      readiness_status: sourceUnit.readiness_status || null,
      readiness_checkout_date: sourceUnit.readiness_checkout_date || null,
      readiness_checkin_date: sourceUnit.readiness_checkin_date || null,
      readiness_guest_name: sourceUnit.readiness_guest_name || null,
      readiness_notes: sourceUnit.readiness_notes || null,
    };

    const { error: updateError } = await supabase
      .from("units")
      .update(updatePayload)
      .in("id", unitIds);

    if (updateError) {
      console.error("Error merging units readiness:", updateError);
      return NextResponse.json(
        { error: updateError.message || "فشل دمج الوحدات" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      group_id: groupId,
      unit_ids: unitIds,
    });
  } catch (error: any) {
    console.error("Error in POST /api/unit-readiness/merge:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error merging units" },
      { status: 500 }
    );
  }
}


