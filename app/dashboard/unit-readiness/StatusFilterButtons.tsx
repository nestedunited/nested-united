"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const FILTER_OPTIONS = [
  { value: "all", label: "الكل", icon: "📋" },
  { value: "checkout_today", label: "خروج اليوم", icon: "📤" },
  { value: "checkin_today", label: "دخول اليوم", icon: "📥" },
  { value: "awaiting_cleaning", label: "في انتظار التنظيف", icon: "⏳" },
  { value: "cleaning_in_progress", label: "قيد التنظيف", icon: "🧹" },
  { value: "ready", label: "جاهزة للتسكين", icon: "✅" },
  { value: "occupied", label: "مشغولة", icon: "🏠" },
  { value: "guest_not_checked_out", label: "الضيف لم يخرج", icon: "⚠️" },
];

export function StatusFilterButtons({ currentStatus }: { currentStatus?: string }) {
  const activeStatus = currentStatus || "all";

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">فلترة حسب الحالة:</h3>
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/dashboard/unit-readiness${option.value !== "all" ? `?status=${option.value}` : ""}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeStatus === option.value
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span>{option.icon}</span>
            <span>{option.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}



