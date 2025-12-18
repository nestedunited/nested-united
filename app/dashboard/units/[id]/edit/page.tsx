"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { usePermission } from "@/lib/hooks/usePermission";

export default function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const canEdit = usePermission("edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unit, setUnit] = useState<any>(null);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (canEdit === false) {
      router.push(`/dashboard/units/${id}?error=no_permission`);
    }
  }, [canEdit, router, id]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/units/${id}`).then((res) => res.json()),
      fetch(`/api/units/${id}/calendars`).then((res) => res.json()),
      fetch(`/api/accounts`).then((res) => res.json()),
    ])
      .then(([unitData, calendarsData, accountsData]) => {
        setUnit(unitData);
        setCalendars(calendarsData || []);
        setAccounts(accountsData || []);
      })
      .catch(console.error);
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      unit_name: formData.get("unit_name"),
      unit_code: formData.get("unit_code") || null,
      city: formData.get("city") || null,
      address: formData.get("address") || null,
      capacity: formData.get("capacity") ? parseInt(formData.get("capacity") as string) : null,
      status: formData.get("status"),
    };

    try {
      const response = await fetch(`/api/units/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "حدث خطأ");
      }

      router.push(`/dashboard/units/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (canEdit === null) {
    return <div className="text-center py-12">جاري التحميل...</div>;
  }

  if (canEdit === false) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
          <p className="font-semibold mb-2">ليس لديك صلاحية لتعديل الوحدات</p>
          <Link href={`/dashboard/units/${id}`} className="text-blue-600 hover:underline">
            العودة للوحدة
          </Link>
        </div>
      </div>
    );
  }

  if (!unit) {
    return <div className="text-center py-12">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/units/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">تعديل الوحدة</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">اسم الوحدة *</label>
            <input
              type="text"
              name="unit_name"
              required
              defaultValue={unit.unit_name}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">كود الوحدة</label>
              <input
                type="text"
                name="unit_code"
                defaultValue={unit.unit_code || ""}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">السعة</label>
              <input
                type="number"
                name="capacity"
                min="1"
                defaultValue={unit.capacity || ""}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
            <input
              type="text"
              name="city"
              defaultValue={unit.city || ""}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
            <input
              type="text"
              name="address"
              defaultValue={unit.address || ""}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
            <select
              name="status"
              defaultValue={unit.status}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">نشطة</option>
              <option value="inactive">غير نشطة</option>
            </select>
          </div>

          {/* Calendars Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">التقاويم والحسابات</h3>
            <p className="text-sm text-gray-600 mb-4">
              كل تقويم مربوط بحساب مستثمر ومنصة (Airbnb أو Gathern)
            </p>
            
            {calendars.length > 0 ? (
              <div className="space-y-3 mb-4">
                {calendars.map((cal) => (
                  <div key={cal.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              cal.platform === "airbnb"
                                ? "bg-red-100 text-red-600"
                                : "bg-green-100 text-green-600"
                            }`}
                          >
                            {cal.platform === "airbnb" ? "🏠 Airbnb" : "💬 Gathern"}
                          </span>
                          {cal.is_primary && (
                            <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-600">
                              ⭐ رئيسي
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 break-all mb-1">{cal.ical_url}</p>
                        {cal.platform_account ? (
                          <p className="text-xs text-gray-500">
                            الحساب: {cal.platform_account.account_name}
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-600">⚠️ غير مربوط بحساب</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-4">لا توجد تقاويم مرتبطة بهذه الوحدة</p>
            )}

            <Link
              href={`/dashboard/units/${id}/calendars`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <span>إدارة التقاويم</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-gray-500 mt-2">
              يمكنك إضافة أو تعديل التقاويم وربطها بحسابات المستثمرين من صفحة إدارة التقاويم
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
            <Link
              href={`/dashboard/units/${id}`}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}





