import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Download, Calendar } from "lucide-react";
import { PlatformExtended } from "@/lib/types/database";
import { BookingsView } from "./BookingsView";
import { BookingsPageClient } from "./BookingsPageClient";

async function getFilters() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: units }] = await Promise.all([
    supabase.from("platform_accounts").select("id, account_name, platform").order("account_name"),
    supabase.from("units").select("id, unit_name, unit_code").order("unit_name"),
  ]);
  return { accounts: accounts || [], units: units || [] };
}

async function getBookings(searchParams?: { from?: string; to?: string; platform_account_id?: string | string[]; unit_id?: string; platform?: string }) {
  const filters = searchParams || {};
  const supabase = await createClient();
  
  // Get manual bookings
  let bookingsQuery = supabase
    .from("bookings")
    .select(`
      *,
      unit:units(id, unit_name, unit_code),
      platform_account:platform_accounts(id, account_name, platform)
    `)
    .order("checkin_date", { ascending: false });

  // Support multiple platform_account_id
  if (filters.platform_account_id) {
    const accountIds = Array.isArray(filters.platform_account_id) 
      ? filters.platform_account_id 
      : [filters.platform_account_id];
    if (accountIds.length > 0) {
      bookingsQuery = bookingsQuery.in("platform_account_id", accountIds);
    }
  }
  if (filters.unit_id) {
    bookingsQuery = bookingsQuery.eq("unit_id", filters.unit_id);
  }
  if (filters.platform && filters.platform !== "ical") {
    bookingsQuery = bookingsQuery.eq("platform", filters.platform);
  }
  if (filters.from) {
    bookingsQuery = bookingsQuery.gte("checkin_date", filters.from);
  }
  if (filters.to) {
    bookingsQuery = bookingsQuery.lte("checkout_date", filters.to);
  }

  const { data: bookingsData } = await bookingsQuery;

  // Get iCal reservations
  let reservationsQuery = supabase
    .from("reservations")
    .select(`
      *,
      unit:units(id, unit_name, unit_code, platform_account_id, platform_account:platform_accounts(id, account_name, platform))
    `)
    .order("start_date", { ascending: false });

  if (filters.unit_id) {
    reservationsQuery = reservationsQuery.eq("unit_id", filters.unit_id);
  }
  if (filters.platform && filters.platform !== "ical") {
    reservationsQuery = reservationsQuery.eq("platform", filters.platform);
  }
  if (filters.from) {
    reservationsQuery = reservationsQuery.gte("start_date", filters.from);
  }
  if (filters.to) {
    reservationsQuery = reservationsQuery.lte("end_date", filters.to);
  }

  const { data: reservationsData } = await reservationsQuery;

  // Combine and format
  const bookings = (bookingsData || []).map((b: any) => ({
    ...b,
    type: "manual",
    id: `booking-${b.id}`,
    checkin_date: b.checkin_date,
    checkout_date: b.checkout_date,
    guest_name: b.guest_name,
    phone: b.phone,
    amount: b.amount,
    currency: b.currency,
    notes: b.notes,
    needs_update: false,
  }));

  const reservations = (reservationsData || []).map((r: any) => ({
    ...r,
    type: "ical",
    id: `reservation-${r.id}`,
    checkin_date: r.start_date,
    checkout_date: r.end_date,
    guest_name: r.summary || "حجز من iCal",
    phone: null,
    amount: null,
    currency: null,
    notes: r.summary,
    platform: r.platform,
    platform_account: r.unit?.platform_account || null,
    needs_update: !r.summary || r.summary === "حجز من iCal" || r.summary.length < 3, // Needs update if summary is missing or too short
  }));

  // Filter by platform_account_id for reservations (through unit)
  let combined = [...bookings, ...reservations];
  if (filters.platform_account_id) {
    const accountIds = Array.isArray(filters.platform_account_id) 
      ? filters.platform_account_id 
      : [filters.platform_account_id];
    if (accountIds.length > 0) {
      combined = combined.filter((item: any) => {
        if (item.type === "manual") {
          return accountIds.includes(item.platform_account_id);
        } else {
          return accountIds.includes(item.unit?.platform_account_id);
        }
      });
    }
  }

  // Sort by checkin_date
  combined.sort((a: any, b: any) => {
    const dateA = new Date(a.checkin_date).getTime();
    const dateB = new Date(b.checkin_date).getTime();
    return dateB - dateA;
  });

  return combined;
}

function formatQuery(params: Record<string, string | string[] | undefined>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) {
      if (Array.isArray(v)) {
        v.forEach((val) => usp.append(k, val));
      } else {
        usp.set(k, v);
      }
    }
  });
  return usp.toString();
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; platform_account_id?: string | string[]; unit_id?: string; platform?: PlatformExtended }> | { from?: string; to?: string; platform_account_id?: string | string[]; unit_id?: string; platform?: PlatformExtended };
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  
  // Handle platform_account_id as array from query params
  const platformAccountIds = resolvedParams.platform_account_id 
    ? (Array.isArray(resolvedParams.platform_account_id) 
        ? resolvedParams.platform_account_id 
        : [resolvedParams.platform_account_id])
    : [];
  
  const { accounts, units } = await getFilters();
  const bookings = await getBookings({ ...resolvedParams, platform_account_id: platformAccountIds.length > 0 ? platformAccountIds : undefined });

  const totalAmount = bookings.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);

  const csvLink = `/api/bookings?${formatQuery({
    from: resolvedParams.from,
    to: resolvedParams.to,
    platform_account_id: platformAccountIds.length > 0 ? platformAccountIds : undefined,
    unit_id: resolvedParams.unit_id,
    platform: resolvedParams.platform,
    export: "csv",
  })}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">الحجوزات</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">إدارة الحجوزات مع فلترة بالتواريخ والحساب والوحدة والمنصة</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link
            href="/dashboard/bookings/calendar"
            className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Calendar className="w-4 h-4" />
            التقويم
          </Link>
          <Link
            href={csvLink}
            className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            تصدير Excel (CSV)
          </Link>
          <BookingsPageClient />
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <label className="text-gray-600">من</label>
          <input type="date" name="from" defaultValue={resolvedParams.from} className="border rounded px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-600">إلى</label>
          <input type="date" name="to" defaultValue={resolvedParams.to} className="border rounded px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-1">
          <label className="text-gray-600">الحسابات (يمكن اختيار أكثر من حساب)</label>
          <div className="border rounded px-3 py-2 max-h-32 overflow-y-auto">
            {accounts.length > 0 ? (
              accounts.map((a: any) => (
                <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1">
                  <input
                    type="checkbox"
                    name="platform_account_id"
                    value={a.id}
                    defaultChecked={platformAccountIds.includes(a.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{a.account_name} — {a.platform}</span>
                </label>
              ))
            ) : (
              <p className="text-gray-400 text-sm">لا توجد حسابات</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-600">الوحدة</label>
          <select name="unit_id" defaultValue={resolvedParams.unit_id || ""} className="border rounded px-3 py-2">
            <option value="">الكل</option>
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.unit_name} {u.unit_code ? `(${u.unit_code})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-gray-600">المنصة / المصدر</label>
          <select name="platform" defaultValue={resolvedParams.platform || ""} className="border rounded px-3 py-2">
            <option value="">الكل</option>
            <option value="airbnb">Airbnb</option>
            <option value="gathern">Gathern</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="manual">يدوي</option>
            <option value="ical">iCal</option>
            <option value="unknown">غير معروف</option>
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-5 flex gap-3 mt-1">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            تطبيق الفلتر
          </button>
          <Link href="/dashboard/bookings" className="px-4 py-2 border rounded hover:bg-gray-50">
            إعادة تعيين
          </Link>
        </div>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">إجمالي الحجوزات</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{bookings.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">إجمالي المبالغ</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalAmount.toFixed(2)} SAR</p>
        </div>
      </div>

      {/* Bookings View (List/Grid/Table) */}
      <BookingsView bookings={bookings} />
    </div>
  );
}

