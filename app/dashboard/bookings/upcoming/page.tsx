import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, CalendarDays, User, Phone, Home, DollarSign, Layers } from "lucide-react";

async function getUpcomingBookings() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  // Get bookings from bookings table
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      *,
      unit:units(id, unit_name, unit_code),
      platform_account:platform_accounts(id, account_name, platform)
    `)
    .gte("checkin_date", today)
    .lte("checkin_date", nextWeekStr)
    .order("checkin_date", { ascending: true });

  // Get reservations from iCal sync
  const { data: reservations } = await supabase
    .from("reservations")
    .select(`
      *,
      unit:units(id, unit_name, unit_code)
    `)
    .gte("start_date", today)
    .lte("start_date", nextWeekStr)
    .order("start_date", { ascending: true });

  // Combine and format
  const allBookings = [
    ...(bookings || []).map((b: any) => ({
      id: b.id,
      type: "manual" as const,
      guest_name: b.guest_name || "غير محدد",
      phone: b.phone,
      checkin_date: b.checkin_date,
      checkout_date: b.checkout_date,
      amount: b.amount,
      currency: b.currency,
      platform: b.platform,
      unit: b.unit,
      platform_account: b.platform_account,
      notes: b.notes,
    })),
    ...(reservations || []).map((r: any) => ({
      id: r.id,
      type: "ical" as const,
      guest_name: r.summary || "حجز من iCal",
      phone: null,
      checkin_date: r.start_date,
      checkout_date: r.end_date,
      amount: null,
      currency: null,
      platform: r.platform,
      unit: r.unit,
      platform_account: null,
      notes: r.summary,
    })),
  ].sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));

  return allBookings;
}

export default async function UpcomingBookingsPage() {
  const bookings = await getUpcomingBookings();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الحجوزات القادمة (7 أيام)</h1>
          <p className="text-gray-600 mt-1">الحجوزات القادمة في الأسبوع القادم</p>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <CalendarDays className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">لا توجد حجوزات قادمة في الأسبوع القادم</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking: any) => (
            <div
              key={booking.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{booking.guest_name}</h3>
                    {booking.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{booking.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  {booking.amount && (
                    <div className="text-lg font-bold text-green-600">
                      {booking.amount} {booking.currency || "SAR"}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {booking.type === "manual" ? (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">يدوي</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">iCal</span>
                    )}
                    {booking.platform && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        {booking.platform}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="font-medium">دخول:</span>{" "}
                    {(() => {
                      const [y, m, d] = booking.checkin_date.split("-");
                      const date = new Date(Number(y), Number(m) - 1, Number(d));
                      return date.toLocaleDateString("ar-EG", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="font-medium">خروج:</span>{" "}
                    {(() => {
                      const [y, m, d] = booking.checkout_date.split("-");
                      const date = new Date(Number(y), Number(m) - 1, Number(d));
                      return date.toLocaleDateString("ar-EG", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                    })()}
                  </div>
                </div>
                {booking.unit && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Home className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="font-medium">الوحدة:</span> {booking.unit.unit_name}
                      {booking.unit.unit_code && (
                        <span className="text-gray-400"> ({booking.unit.unit_code})</span>
                      )}
                    </div>
                  </div>
                )}
                {booking.platform_account && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Layers className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="font-medium">الحساب:</span> {booking.platform_account.account_name}
                    </div>
                  </div>
                )}
              </div>

              {booking.notes && (
                <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {booking.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




