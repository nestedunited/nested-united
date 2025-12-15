import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";

// GET /api/units/[id]/readiness-default - Suggest checkin/checkout dates & guest name from bookings/iCal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const currentUser = await getCurrentUser();

    // Allow admins + maintenance workers to fetch suggested dates
    if (
      !currentUser ||
      !(isAdmin(currentUser) || currentUser.role === "maintenance_worker")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Helper to pick current stay or nearest future stay
    // 1) Try to find a stay that covers today
    const { data: currentBookings } = await supabase
      .from("bookings")
      .select("guest_name, checkin_date, checkout_date")
      .eq("unit_id", id)
      .lte("checkin_date", today)
      .gte("checkout_date", today)
      .order("checkin_date", { ascending: false })
      .limit(1);

    const { data: currentReservations } = await supabase
      .from("reservations")
      .select("summary, start_date, end_date")
      .eq("unit_id", id)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("start_date", { ascending: false })
      .limit(1);

    let checkin_date: string | null = null;
    let checkout_date: string | null = null;
    let guest_name: string | null = null;

    if (currentBookings && currentBookings.length > 0) {
      const b = currentBookings[0];
      checkin_date = b.checkin_date;
      checkout_date = b.checkout_date;
      guest_name = b.guest_name;
    } else if (currentReservations && currentReservations.length > 0) {
      const r = currentReservations[0];
      checkin_date = r.start_date;
      checkout_date = r.end_date;
      guest_name = r.summary || "حجز من iCal";
    } else {
      // 2) If no current stay, look for nearest future stay (bookings + reservations)
      const { data: futureBookings } = await supabase
        .from("bookings")
        .select("guest_name, checkin_date, checkout_date")
        .eq("unit_id", id)
        .gt("checkin_date", today)
        .order("checkin_date", { ascending: true })
        .limit(1);

      const { data: futureReservations } = await supabase
        .from("reservations")
        .select("summary, start_date, end_date")
        .eq("unit_id", id)
        .gt("start_date", today)
        .order("start_date", { ascending: true })
        .limit(1);

      // Choose the earliest among future bookings/reservations
      let futureBooking = futureBookings && futureBookings[0];
      let futureReservation = futureReservations && futureReservations[0];

      if (futureBooking && futureReservation) {
        if (futureBooking.checkin_date <= futureReservation.start_date) {
          checkin_date = futureBooking.checkin_date;
          checkout_date = futureBooking.checkout_date;
          guest_name = futureBooking.guest_name;
        } else {
          checkin_date = futureReservation.start_date;
          checkout_date = futureReservation.end_date;
          guest_name = futureReservation.summary || "حجز من iCal";
        }
      } else if (futureBooking) {
        checkin_date = futureBooking.checkin_date;
        checkout_date = futureBooking.checkout_date;
        guest_name = futureBooking.guest_name;
      } else if (futureReservation) {
        checkin_date = futureReservation.start_date;
        checkout_date = futureReservation.end_date;
        guest_name = futureReservation.summary || "حجز من iCal";
      }
    }

    // If nothing found, just return empty (the form سيبقى يدوي)
    if (!checkin_date && !checkout_date && !guest_name) {
      return NextResponse.json({ checkin_date: null, checkout_date: null, guest_name: null });
    }

    return NextResponse.json({
      checkin_date,
      checkout_date,
      guest_name,
    });
  } catch (error: any) {
    console.error("Error in GET /api/units/[id]/readiness-default:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error fetching default readiness dates" },
      { status: 500 }
    );
  }
}


