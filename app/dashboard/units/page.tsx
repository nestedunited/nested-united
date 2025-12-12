import { createClient } from "@/lib/supabase/server";
import { Plus, Building2, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { UnitsPageClient } from "./UnitsPageClient";
import { UnitsDeleteButton } from "./UnitsDeleteButton";

async function getUnits() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select(`*, platform_account:platform_accounts(*)`)
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function UnitsPage() {
  const units = await getUnits();
  const activeUnits = units.filter((u) => u.status === "active");
  const inactiveUnits = units.filter((u) => u.status === "inactive");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الوحدات</h1>
          <p className="text-gray-600 mt-1">إدارة جميع الوحدات</p>
        </div>
        <UnitsPageClient />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-blue-500">
          <p className="text-gray-600 text-sm">إجمالي الوحدات</p>
          <p className="text-3xl font-bold">{units.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-green-500">
          <p className="text-gray-600 text-sm">نشطة</p>
          <p className="text-3xl font-bold">{activeUnits.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-gray-400">
          <p className="text-gray-600 text-sm">غير نشطة</p>
          <p className="text-3xl font-bold">{inactiveUnits.length}</p>
        </div>
      </div>

      {/* Units Grid */}
      {units.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <div
              key={unit.id}
              className={`bg-white rounded-lg shadow p-4 hover:shadow-lg transition ${
                unit.status === "inactive" ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <Link href={`/dashboard/units/${unit.id}`} className="flex-1">
                  <div>
                    <h3 className="font-semibold text-lg">{unit.unit_name}</h3>
                    {unit.unit_code && (
                      <p className="text-gray-500 text-sm">كود: {unit.unit_code}</p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      unit.platform_account?.platform === "airbnb"
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {unit.platform_account?.platform === "airbnb" ? "Airbnb" : "Gathern"}
                  </span>
                  <UnitsDeleteButton unitId={unit.id} unitName={unit.unit_name} />
                </div>
              </div>
              <Link href={`/dashboard/units/${unit.id}`}>
                {unit.city && (
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
                    <MapPin className="w-4 h-4" />
                    <span>{unit.city}</span>
                  </div>
                )}
                {unit.capacity && (
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{unit.capacity} أشخاص</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      unit.status === "active"
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {unit.status === "active" ? "نشطة" : "غير نشطة"}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">لا توجد وحدات</p>
          <Link href="/dashboard/units/new" className="text-blue-600 mt-2 inline-block">
            أضف وحدتك الأولى
          </Link>
        </div>
      )}
    </div>
  );
}
