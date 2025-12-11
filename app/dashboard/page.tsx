import { createClient } from "@/lib/supabase/server";
import { Building2, Calendar, Wrench, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { SyncButton } from "./SyncButton";

async function getDashboardStats() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Total units
  const { count: totalUnits } = await supabase
    .from("units")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // Units booked today - from bookings table (manual) + reservations (iCal)
  const { count: bookedTodayBookings } = await supabase
    .from("bookings")
    .select("unit_id", { count: "exact", head: true })
    .lte("checkin_date", today)
    .gte("checkout_date", today);

  const { count: bookedTodayReservations } = await supabase
    .from("reservations")
    .select("unit_id", { count: "exact", head: true })
    .lte("start_date", today)
    .gte("end_date", today);

  // Get unique unit IDs to avoid double counting
  const { data: bookingsToday } = await supabase
    .from("bookings")
    .select("unit_id")
    .lte("checkin_date", today)
    .gte("checkout_date", today);

  const { data: reservationsToday } = await supabase
    .from("reservations")
    .select("unit_id")
    .lte("start_date", today)
    .gte("end_date", today);

  const uniqueUnitsToday = new Set([
    ...(bookingsToday || []).map((b: any) => b.unit_id),
    ...(reservationsToday || []).map((r: any) => r.unit_id),
  ]).size;

  // Upcoming check-ins (next 7 days) - from bookings + reservations
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("id")
    .gte("checkin_date", today)
    .lte("checkin_date", nextWeekStr);

  const { data: upcomingReservations } = await supabase
    .from("reservations")
    .select("id")
    .gte("start_date", today)
    .lte("start_date", nextWeekStr);

  const upcomingCheckIns = (upcomingBookings?.length || 0) + (upcomingReservations?.length || 0);

  // Open maintenance tickets
  const { count: openTickets } = await supabase
    .from("maintenance_tickets")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);

  // Last sync
  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(1)
    .single();

  // Calendars count
  const { count: calendarsCount } = await supabase
    .from("unit_calendars")
    .select("*", { count: "exact", head: true });

  return {
    totalUnits: totalUnits || 0,
    bookedToday: uniqueUnitsToday,
    upcomingCheckIns,
    openTickets: openTickets || 0,
    lastSync,
    calendarsCount: calendarsCount || 0,
  };
}

async function getCurrentUserName() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) return "المستخدم";
  
  const { data: user } = await supabase
    .from("users")
    .select("name")
    .eq("id", authUser.id)
    .single();
  
  return user?.name || "المستخدم";
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  link?: string;
}

function StatCard({ title, value, icon: Icon, color, link }: StatCardProps) {
  const content = (
    <div className={`bg-white rounded-lg shadow p-6 border-r-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-gray-100`}>
          <Icon className={`w-8 h-8 ${color.replace("border-", "text-")}`} />
        </div>
      </div>
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}

export default async function DashboardPage() {
  const [userName, stats] = await Promise.all([
    getCurrentUserName(),
    getDashboardStats()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          مرحبًا، {userName}
        </h1>
        <p className="text-gray-600">
          نظرة عامة على الوحدات والحجوزات والصيانة
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي الوحدات النشطة"
          value={stats.totalUnits}
          icon={Building2}
          color="border-blue-500"
          link="/dashboard/units"
        />
        <StatCard
          title="وحدات محجوزة اليوم"
          value={stats.bookedToday}
          icon={Calendar}
          color="border-green-500"
        />
        <StatCard
          title="حجوزات قادمة (7 أيام)"
          value={stats.upcomingCheckIns}
          icon={CheckCircle2}
          color="border-purple-500"
          link="/dashboard/bookings/upcoming"
        />
        <StatCard
          title="تذاكر صيانة مفتوحة"
          value={stats.openTickets}
          icon={Wrench}
          color="border-orange-500"
          link="/dashboard/maintenance"
        />
      </div>

      {/* Sync Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              مزامنة التقويمات (iCal)
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {stats.calendarsCount} رابط تقويم مُعد
            </p>
          </div>
          <SyncButton />
        </div>

        {stats.lastSync ? (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">آخر مزامنة:</span>
              <span className="font-medium">
                {new Date(stats.lastSync.run_at).toLocaleString("ar-EG")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">الحالة:</span>
              <span
                className={`px-2 py-1 rounded text-sm font-medium ${
                  stats.lastSync.status === "success"
                    ? "bg-green-100 text-green-700"
                    : stats.lastSync.status === "partial"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {stats.lastSync.status === "success"
                  ? "✓ نجحت"
                  : stats.lastSync.status === "partial"
                  ? "⚠ جزئية"
                  : "✗ فشلت"}
              </span>
            </div>
            {stats.lastSync.message && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">الرسالة:</span>
                <span className="text-sm">{stats.lastSync.message}</span>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>وحدات: {stats.lastSync.units_processed || 0}</span>
              {stats.lastSync.errors_count > 0 && (
                <span className="text-red-600">أخطاء: {stats.lastSync.errors_count}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700">
              ⚠ لم يتم تشغيل المزامنة بعد. اضغط &quot;مزامنة الآن&quot; لبدء المزامنة.
            </p>
            {stats.calendarsCount === 0 && (
              <p className="text-yellow-600 text-sm mt-2">
                تحتاج أولاً إضافة روابط iCal للوحدات من صفحة الوحدات.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          إجراءات سريعة
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/units"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">إدارة الوحدات</p>
              <p className="text-sm text-gray-500">عرض وإضافة الوحدات</p>
            </div>
          </Link>

          <Link
            href="/dashboard/maintenance"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
          >
            <Wrench className="w-6 h-6 text-orange-600" />
            <div>
              <p className="font-medium text-gray-900">تذاكر الصيانة</p>
              <p className="text-sm text-gray-500">متابعة الصيانة</p>
            </div>
          </Link>

          <Link
            href="/dashboard/accounts"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition"
          >
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">الحسابات</p>
              <p className="text-sm text-gray-500">Airbnb و Gathern</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
