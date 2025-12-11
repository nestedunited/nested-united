import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CalendarView } from "./CalendarView";

async function getBookingsForMonth(year: number, month: number) {
  const supabase = await createClient();
  const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
  const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];

  // Get bookings from bookings table
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      *,
      unit:units(id, unit_name, unit_code),
      platform_account:platform_accounts(id, account_name, platform)
    `)
    .lte("checkin_date", lastDay)
    .gte("checkout_date", firstDay)
    .order("checkin_date", { ascending: true });

  // Get reservations from iCal sync
  const { data: reservations } = await supabase
    .from("reservations")
    .select(`
      *,
      unit:units(id, unit_name, unit_code)
    `)
    .lte("start_date", lastDay)
    .gte("end_date", firstDay)
    .order("start_date", { ascending: true });

  // Combine and format
  const allBookings = [
    ...(bookings || []).map((b: any) => ({
      id: b.id,
      type: "manual" as const,
      guest_name: b.guest_name || "غير محدد",
      checkin_date: b.checkin_date,
      checkout_date: b.checkout_date,
      unit: b.unit,
      platform_account: b.platform_account,
    })),
    ...(reservations || []).map((r: any) => ({
      id: r.id,
      type: "ical" as const,
      guest_name: r.summary || "حجز من iCal",
      checkin_date: r.start_date,
      checkout_date: r.end_date,
      unit: r.unit,
      platform_account: null,
    })),
  ];

  return allBookings;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; month?: string }> | { year?: string; month?: string };
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const today = new Date();
  const year = resolvedParams.year ? parseInt(resolvedParams.year) : today.getFullYear();
  const month = resolvedParams.month ? parseInt(resolvedParams.month) - 1 : today.getMonth();

  const bookings = await getBookingsForMonth(year, month);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bookings" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">تقويم الحجوزات</h1>
          <p className="text-gray-600 mt-1">عرض جميع الحجوزات في شكل تقويم شهري</p>
        </div>
      </div>

      <CalendarView year={year} month={month} initialBookings={bookings} />
    </div>
  );
}
