import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// GET /api/bookings - list bookings with optional filters
export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const platformAccountId = searchParams.get("platform_account_id");
  const unitId = searchParams.get("unit_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const exportCsv = searchParams.get("export") === "csv";

  let query = supabase
    .from("bookings")
    .select("*, unit:units(id, unit_name, unit_code)")
    .order("checkin_date", { ascending: false });

  if (platformAccountId) query = query.eq("platform_account_id", platformAccountId);
  if (unitId) query = query.eq("unit_id", unitId);
  if (from) query = query.gte("checkin_date", from);
  if (to) query = query.lte("checkout_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookingsRows = data || [];

  // أيضاً نجلب حجوزات iCal من جدول reservations لتضمينها في التصدير
  const { data: reservationsData, error: reservationsError } = await supabase
    .from("reservations")
    .select(`*, unit:units(id, unit_name, unit_code)`)
    .order("start_date", { ascending: false });

  if (reservationsError) {
    console.error("Reservations fetch error:", reservationsError);
  }

  const reservationsRows = (reservationsData || []).map((r: any) => ({
    guest_name: r.summary || "حجز iCal",
    phone: null,
    checkin_date: r.start_date,
    checkout_date: r.end_date,
    unit: r.unit,
    platform: r.platform || "ical",
    platform_account_id: r.unit?.platform_account_id ?? null,
    amount: null,
    currency: null,
    notes: r.summary || "",
  }));

  const rows = [...bookingsRows, ...reservationsRows].sort(
    (a: any, b: any) =>
      new Date(b.checkin_date || b.start_date).getTime() -
      new Date(a.checkin_date || a.start_date).getTime()
  );

  if (!exportCsv) {
    return NextResponse.json(rows);
  }

  // CSV export
  const header = [
    "guest_name",
    "phone",
    "checkin_date",
    "checkout_date",
    "unit_name",
    "unit_code",
    "platform",
    "platform_account_id",
    "amount",
    "currency",
    "notes",
  ];

  const csvLines = [
    header.join(","),
    ...rows.map((b: any) =>
      [
        b.guest_name ?? "",
        b.phone ?? "",
        b.checkin_date ?? "",
        b.checkout_date ?? "",
        b.unit?.unit_name ?? "",
        b.unit?.unit_code ?? "",
        b.platform ?? "",
        b.platform_account_id ?? "",
        b.amount ?? 0,
        b.currency ?? "SAR",
        (b.notes ?? "").replace(/"/g, '""'),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  return new NextResponse(csvLines, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=bookings.csv",
    },
  });
}

// POST /api/bookings - create booking
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    unit_id,
    platform_account_id,
    platform,
    guest_name,
    phone,
    checkin_date,
    checkout_date,
    amount,
    currency,
    notes,
  } = body;

  if (!unit_id || !guest_name || !checkin_date || !checkout_date) {
    return NextResponse.json({ error: "الحقول الأساسية مطلوبة" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      unit_id,
      platform_account_id: platform_account_id || null,
      platform: platform || null,
      guest_name,
      phone: phone || null,
      checkin_date,
      checkout_date,
      amount: amount ?? 0,
      currency: currency || "SAR",
      notes: notes || null,
      created_by: currentUser.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

