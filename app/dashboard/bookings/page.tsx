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

async function getBookings(searchParams?: { from?: string; to?: string; platform_account_id?: string | string[]; unit_id?: string; platform?: string; today?: string }) {
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
    // تعديل 1: ترتيب تصاعدي (من الأقدم للأحدث)
    .order("checkin_date", { ascending: true });

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

  // فلترة حجوزات اليوم: اليوم يكون ضمن فترة الحجز
  if (filters.today) {
    bookingsQuery = bookingsQuery
      .lte("checkin_date", filters.today)
      .gte("checkout_date", filters.today);
  } else {
    // فلترة بالتاريخ
    if (filters.from && filters.to) {
      bookingsQuery = bookingsQuery
        .gte("checkin_date", filters.from)
        .lte("checkout_date", filters.to);
    } else if (filters.from) {
      bookingsQuery = bookingsQuery.gte("checkin_date", filters.from);
    } else if (filters.to) {
      bookingsQuery = bookingsQuery.lte("checkout_date", filters.to);
    }
  }

  const { data: bookingsData } = await bookingsQuery;

  // Get iCal reservations
  let reservationsQuery = supabase
    .from("reservations")
    .select(`
      *,
      unit:units(
        id,
        unit_name,
        unit_code,
        unit_calendars:unit_calendars(
          id,
          platform,
          is_primary,
          platform_account:platform_accounts(id, account_name, platform)
        )
      )
    `)
    // تعديل 2: ترتيب تصاعدي (من الأقدم للأحدث)
    .order("start_date", { ascending: true });

  if (filters.unit_id) {
    reservationsQuery = reservationsQuery.eq("unit_id", filters.unit_id);
  }
  if (filters.platform && filters.platform !== "ical") {
    reservationsQuery = reservationsQuery.eq("platform", filters.platform);
  }

  if (filters.today) {
    reservationsQuery = reservationsQuery
      .lte("start_date", filters.today)
      .gte("end_date", filters.today);
  } else {
    if (filters.from && filters.to) {
      reservationsQuery = reservationsQuery
        .gte("start_date", filters.from)
        .lte("end_date", filters.to);
    } else if (filters.from) {
      reservationsQuery = reservationsQuery.gte("start_date", filters.from);
    } else if (filters.to) {
      reservationsQuery = reservationsQuery.lte("end_date", filters.to);
    }
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

  const reservations = (reservationsData || []).map((r: any) => {
    // Find matching calendar for this reservation's platform
    const matchingCalendar = (r.unit?.unit_calendars || []).find(
      (cal: any) => cal.platform === r.platform
    );
    return {
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
      platform_account: matchingCalendar?.platform_account || null,
      needs_update: !r.summary || r.summary === "حجز من iCal" || r.summary.length < 3,
    };
  });

  // Filter by platform_account_id for reservations
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
          return item.platform_account && accountIds.includes(item.platform_account.id);
        }
      });
    }
  }

  // تعديل 3: الترتيب النهائي (تصاعدي: الأقرب للأبعد)
  combined.sort((a: any, b: any) => {
    const dateA = new Date(a.checkin_date).getTime();
    const dateB = new Date(b.checkin_date).getTime();
    // A - B تعني تصاعدي (الصغير للكبير)
    return dateA - dateB; 
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
  searchParams?: Promise<{ from?: string; to?: string; platform_account_id?: string | string[]; unit_id?: string; platform?: PlatformExtended; today?: string }> | { from?: string; to?: string; platform_account_id?: string | string[]; unit_id?: string; platform?: PlatformExtended; today?: string };
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  
  const platformAccountIds = resolvedParams.platform_account_id 
    ? (Array.isArray(resolvedParams.platform_account_id) 
        ? resolvedParams.platform_account_id 
        : [resolvedParams.platform_account_id])
    : [];
  
  const { accounts, units } = await getFilters();
  const bookings = await getBookings({ ...resolvedParams, platform_account_id: platformAccountIds.length > 0 ? platformAccountIds : undefined });

  // Count bookings by type
  const manualBookings = bookings.filter((b: any) => b.type === "manual").length;
  const icalBookings = bookings.filter((b: any) => b.type === "ical").length;
  const totalAmount = bookings.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);

  const csvLink = `/api/bookings?${formatQuery({
    from: resolvedParams.from,
    to: resolvedParams.to,
    today: resolvedParams.today,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">إجمالي الحجوزات</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{bookings.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">يدوية</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{manualBookings}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">من iCal</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{icalBookings}</p>
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