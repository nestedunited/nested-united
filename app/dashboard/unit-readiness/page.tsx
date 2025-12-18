import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Building2, Calendar, User, Filter } from "lucide-react";
import Link from "next/link";
import { UpdateStatusButton } from "./UpdateStatusButton";
import { StatusFilterButtons } from "./StatusFilterButtons";

// Status configurations with Arabic labels and colors
const STATUS_CONFIG = {
  checkout_today: {
    label: "خروج اليوم",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: "📤",
  },
  checkin_today: {
    label: "دخول اليوم",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: "📥",
  },
  guest_not_checked_out: {
    label: "الضيف لم يخرج",
    color: "bg-red-100 text-red-800 border-red-300",
    icon: "⚠️",
  },
  awaiting_cleaning: {
    label: "في انتظار التنظيف",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: "⏳",
  },
  cleaning_in_progress: {
    label: "قيد التنظيف",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    icon: "🧹",
  },
  ready: {
    label: "جاهزة للتسكين",
    color: "bg-green-100 text-green-800 border-green-300",
    icon: "✅",
  },
  occupied: {
    label: "تم التسكين",
    color: "bg-gray-100 text-gray-800 border-gray-300",
    icon: "🏠",
  },
  booked: {
    label: "إشغال",
    color: "bg-indigo-100 text-indigo-800 border-indigo-300",
    icon: "📅",
  },
};

async function getUnitsWithReadiness(statusFilter?: string | null) {
  const supabase = await createClient();

  try {
    let query = supabase
      .from("units")
      .select(`
        *,
      unit_calendars:unit_calendars(
        id,
        platform,
        is_primary,
        platform_account:platform_accounts(id, platform, account_name)
      )
      `)
      .eq("status", "active")
      .order("unit_name");

    const { data: units, error } = await query;

    if (error) {
      console.error("[Unit Readiness] Error fetching units:", error.message);
      return [];
    }

    if (!units) return [];

    // Group units by a logical key to avoid duplicates in readiness view.
    // - أولاً حسب readiness_group_id (لو تم دمج الوحدات يدوياً)
    // - ثم حسب unit_code إذا كانت موجودة
    // - وإلا حسب اسم الوحدة
    // - وأخيراً نستخدم id كاحتياط
    const grouped = new Map<
      string,
      {
        primary: any;
        units: any[];
      }
    >();

    for (const unit of units) {
      const key =
        (unit.readiness_group_id as string | null) ||
        (unit.unit_code as string | null) ||
        (unit.unit_name as string | null) ||
        (unit.id as string);

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, { primary: unit, units: [unit] });
      } else {
        existing.units.push(unit);
      }
    }

    // نبني كائن واحد يمثل المجموعة مع الاحتفاظ بكل الوحدات المدموجة في حقل خاص
    let uniqueUnits = Array.from(grouped.values()).map(({ primary, units }) => ({
      ...primary,
      _merged_units: units,
    }));

    // Filter by status if provided
    if (statusFilter && statusFilter !== "all") {
      uniqueUnits = uniqueUnits.filter((unit: any) => unit.readiness_status === statusFilter);
    }

    return uniqueUnits;
  } catch (err: any) {
    console.error("[Unit Readiness] Unexpected error:", err?.message || err);
    return [];
  }
}

export default async function UnitReadinessPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }> | { status?: string };
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const [currentUser, units] = await Promise.all([
    getCurrentUser(),
    getUnitsWithReadiness(resolvedParams.status),
  ]);

  const isSuperAdmin = currentUser?.role === "super_admin";

  // Calculate statistics
  const stats = {
    checkout_today: units.filter((u: any) => u.readiness_status === "checkout_today").length,
    checkin_today: units.filter((u: any) => u.readiness_status === "checkin_today").length,
    awaiting_cleaning: units.filter((u: any) => u.readiness_status === "awaiting_cleaning").length,
    cleaning_in_progress: units.filter((u: any) => u.readiness_status === "cleaning_in_progress").length,
    ready: units.filter((u: any) => u.readiness_status === "ready").length,
    occupied: units.filter((u: any) => u.readiness_status === "occupied").length,
    guest_not_checked_out: units.filter((u: any) => u.readiness_status === "guest_not_checked_out").length,
    booked: units.filter((u: any) => u.readiness_status === "booked").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">جاهزية الوحدات</h1>
          <p className="text-gray-600 mt-1">متابعة حالة الوحدات والتنظيف</p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/dashboard/unit-readiness/merge"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            دمج وحدات
          </Link>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div
            key={key}
            className={`p-4 rounded-lg border-2 ${config.color} transition-all hover:shadow-md`}
          >
            <div className="text-2xl mb-2">{config.icon}</div>
            <div className="text-2xl font-bold">
              {stats[key as keyof typeof stats]}
            </div>
            <div className="text-sm mt-1">{config.label}</div>
          </div>
        ))}
      </div>

      {/* Status Filter */}
      <StatusFilterButtons currentStatus={resolvedParams.status} />

      {/* Units Grid */}
      {units.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">لا توجد وحدات تطابق الفلتر المحدد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit: any) => {
            const status = unit.readiness_status || "ready";
            const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            const mergedUnits: any[] = unit._merged_units || [unit];
            // Extract platforms from unit_calendars (from all merged units)
            const platforms = Array.from(
              new Set(
                mergedUnits
                  .flatMap((u) => (u.unit_calendars || []).map((cal: any) => cal.platform))
                  .filter(Boolean)
              )
            );

            return (
              <div
                key={unit.id}
                className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-all hover:shadow-lg overflow-hidden"
              >
                {/* Status Bar */}
                <div className={`p-3 ${config.color} border-b-2`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-2">
                      <span className="text-xl">{config.icon}</span>
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Unit Details */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {unit.unit_name}
                    </h3>
                    {unit.unit_code && (
                      <p className="text-sm text-gray-600">رمز: {unit.unit_code}</p>
                    )}
                    {/* Platform badges - تعرض كل المنصات المرتبطة بالوحدة المدموجة */}
                    {platforms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        {platforms.map((platform) => (
                          <span
                            key={platform as string}
                            className={`px-2 py-1 rounded text-xs font-medium border ${
                              platform === "airbnb"
                                ? "bg-red-100 text-red-700 border-red-300"
                                : "bg-green-100 text-green-700 border-green-300"
                            }`}
                          >
                            {platform === "airbnb" ? "🏠 Airbnb" : "💬 Gathern"}
                          </span>
                        ))}
                        {platforms.length > 1 && (
                          <span className="px-2 py-1 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            وحدات مدموجة
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dates - تاريخ الدخول أعلى من تاريخ الخروج */}
                  {(unit.readiness_checkout_date || unit.readiness_checkin_date) && (
                    <div className="space-y-2 text-sm">
                      {unit.readiness_checkin_date && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="w-4 h-4" />
                          <span>دخول: {new Date(unit.readiness_checkin_date).toLocaleDateString("ar-EG")}</span>
                        </div>
                      )}
                      {unit.readiness_checkout_date && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="w-4 h-4" />
                          <span>خروج: {new Date(unit.readiness_checkout_date).toLocaleDateString("ar-EG")}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Guest Name */}
                  {unit.readiness_guest_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <User className="w-4 h-4" />
                      <span>{unit.readiness_guest_name}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {unit.readiness_notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {unit.readiness_notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                    <UpdateStatusButton
                      unit={unit}
                      currentStatus={status}
                    />
                    <Link
                      href={`/dashboard/units/${unit.id}`}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-center transition-colors"
                    >
                      التفاصيل
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

