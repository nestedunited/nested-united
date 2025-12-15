import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MergeUnitsPageClient } from "../MergeUnitsPageClient";

async function getUnitsForMerge() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select(`
      id,
      unit_name,
      unit_code,
      readiness_group_id,
      platform_account:platform_accounts(id, platform, account_name)
    `)
    .eq("status", "active")
    .order("unit_name");

  if (error) {
    console.error("[Merge Units] Error fetching units:", error.message);
    return [];
  }

  // Supabase قد يرجع platform_account كمصفوفة، لذلك نطبعها لكائن واحد ليتوافق مع نوع UnitOption
  const rows = (data || []) as any[];
  return rows.map((u) => ({
    ...u,
    platform_account: Array.isArray(u.platform_account)
      ? u.platform_account[0] || null
      : u.platform_account || null,
  }));
}

export default async function MergeUnitsPage() {
  // Ensure only super admin can access this page
  await requireSuperAdmin();
  const units = await getUnitsForMerge();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/unit-readiness"
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دمج وحدات</h1>
          <p className="text-gray-600 text-sm mt-1">
            ربط حالة الجاهزية بين وحدات تمثل نفس الوحدة الفعلية (مثلاً نفس الشقة على أكثر من منصة).
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <MergeUnitsPageClient units={units} />
      </div>
    </div>
  );
}


