"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NewUnitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then(setAccounts)
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      platform_account_id: formData.get("platform_account_id"),
      unit_name: formData.get("unit_name"),
      unit_code: formData.get("unit_code") || null,
      city: formData.get("city") || null,
      address: formData.get("address") || null,
      capacity: formData.get("capacity") ? parseInt(formData.get("capacity") as string) : null,
      status: "active",
    };

    try {
      const response = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "حدث خطأ");
      }

      router.push("/dashboard/units");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/units" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">إضافة وحدة جديدة</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الحساب *</label>
            <select
              name="platform_account_id"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر الحساب</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({acc.platform === "airbnb" ? "Airbnb" : "Gathern"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">اسم الوحدة *</label>
            <input
              type="text"
              name="unit_name"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="مثال: شقة الملز"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">كود الوحدة</label>
              <input
                type="text"
                name="unit_code"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="A101"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">السعة</label>
              <input
                type="number"
                name="capacity"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="4"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المدينة</label>
            <input
              type="text"
              name="city"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="الرياض"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
            <input
              type="text"
              name="address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="حي الملز، شارع..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "جاري الحفظ..." : "حفظ الوحدة"}
            </button>
            <Link
              href="/dashboard/units"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}





