"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "checkout_today", label: "خروج اليوم", icon: "📤" },
  { value: "checkin_today", label: "دخول اليوم", icon: "📥" },
  { value: "guest_not_checked_out", label: "الضيف لم يخرج", icon: "⚠️" },
  { value: "awaiting_cleaning", label: "في انتظار التنظيف", icon: "⏳" },
  { value: "cleaning_in_progress", label: "قيد التنظيف", icon: "🧹" },
  { value: "ready", label: "جاهزة للتسكين", icon: "✅" },
  { value: "occupied", label: "تم التسكين", icon: "🏠" },
];

export function UpdateStatusButton({ unit, currentStatus }: { unit: any; currentStatus: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: currentStatus,
    checkout_date: unit.readiness_checkout_date || "",
    checkin_date: unit.readiness_checkin_date || "",
    guest_name: unit.readiness_guest_name || "",
    notes: unit.readiness_notes || "",
  });
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/units/${unit.id}/readiness`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "فشل تحديث الحالة");
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating status:", error);
      alert(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تحديث الحالة"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <Edit className="w-4 h-4" />
        تحديث الحالة
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                تحديث حالة الوحدة: {unit.unit_name}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الحالة
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checkout Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ الخروج (اختياري)
                  </label>
                  <input
                    type="date"
                    value={formData.checkout_date}
                    onChange={(e) => setFormData({ ...formData, checkout_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Checkin Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ الدخول (اختياري)
                  </label>
                  <input
                    type="date"
                    value={formData.checkin_date}
                    onChange={(e) => setFormData({ ...formData, checkin_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Guest Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم الضيف (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formData.guest_name}
                    onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    placeholder="اسم الضيف"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ملاحظات (اختياري)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="ملاحظات إضافية..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "جاري الحفظ..." : "حفظ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

