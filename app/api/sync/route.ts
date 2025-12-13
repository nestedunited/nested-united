import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import ICAL from "ical.js";

interface ParsedEvent {
  start: string;
  end: string;
  summary: string | null;
  uid: string | null;
}

async function parseICalUrl(url: string): Promise<ParsedEvent[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RentalsDashboard/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const icalText = await response.text();
    const jcalData = ICAL.parse(icalText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    const events: ParsedEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      
      if (event.startDate && event.endDate) {
        events.push({
          start: event.startDate.toJSDate().toISOString().split("T")[0],
          end: event.endDate.toJSDate().toISOString().split("T")[0],
          summary: event.summary || null,
          uid: event.uid || null,
        });
      }
    }

    return events;
  } catch (error: any) {
    console.error(`Error parsing iCal from ${url}:`, error.message);
    throw error;
  }
}

export async function POST() {
  const supabase = await createClient();
  const startTime = new Date();

  let unitsProcessed = 0;
  let errorsCount = 0;
  let newBookings = 0;
  const errors: string[] = [];

  try {
    // Get all unit calendars with active units
    const { data: calendars, error: fetchError } = await supabase
      .from("unit_calendars")
      .select(`
        *,
        unit:units!inner(id, unit_name, status)
      `)
      .eq("unit.status", "active");

    if (fetchError) {
      throw fetchError;
    }

    if (!calendars || calendars.length === 0) {
      await logSync(supabase, "success", "لا توجد تقويمات للمزامنة", 0, 0);
      return NextResponse.json({
        success: true,
        message: "لا توجد تقويمات للمزامنة",
        unitsProcessed: 0,
      });
    }

    // Process each calendar
    for (const calendar of calendars) {
      try {
        console.log(`Syncing: ${calendar.unit.unit_name} (${calendar.platform})`);

        const events = await parseICalUrl(calendar.ical_url);

        // Upsert events as reservations
        for (const event of events) {
          const { error: upsertError } = await supabase
            .from("reservations")
            .upsert(
              {
                unit_id: calendar.unit_id,
                platform: calendar.platform,
                start_date: event.start,
                end_date: event.end,
                summary: event.summary,
                raw_event: event,
                last_synced_at: new Date().toISOString(),
              },
              {
                onConflict: "unit_id,platform,start_date,end_date",
              }
            );

          if (upsertError) {
            console.error("Upsert error:", upsertError);
          } else {
            newBookings++;
          }
        }

        // Update unit's last_synced_at
        await supabase
          .from("units")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", calendar.unit_id);

        unitsProcessed++;
      } catch (error: any) {
        errorsCount++;
        errors.push(`${calendar.unit.unit_name}: ${error.message}`);
        console.error(`Error syncing ${calendar.unit.unit_name}:`, error);
      }
    }

    // Determine status
    const status = errorsCount === 0 
      ? "success" 
      : errorsCount === calendars.length 
        ? "failed" 
        : "partial";

    const message = `تمت معالجة ${unitsProcessed} وحدة، ${newBookings} حجز، ${errorsCount} أخطاء`;

    // Log sync result
    await logSync(supabase, status, message, unitsProcessed, errorsCount, { errors });

    // Create notification if new bookings found
    if (newBookings > 0) {
      await supabase.from("notifications").insert({
        type: "booking_created",
        title: "مزامنة جديدة",
        body: `تم تحديث ${newBookings} حجز من ${unitsProcessed} وحدة`,
        audience: "all_admins",
      });
    }

    const duration = (new Date().getTime() - startTime.getTime()) / 1000;

    return NextResponse.json({
      success: true,
      status,
      message,
      unitsProcessed,
      newBookings,
      errorsCount,
      duration: `${duration}s`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    await logSync(supabase, "failed", error.message, unitsProcessed, errorsCount + 1);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

async function logSync(
  supabase: any,
  status: string,
  message: string,
  unitsProcessed: number,
  errorsCount: number,
  details?: any
) {
  await supabase.from("sync_logs").insert({
    status,
    message,
    units_processed: unitsProcessed,
    errors_count: errorsCount,
    details: details || null,
  });
}

// GET to check sync status
export async function GET() {
  const supabase = await createClient();

  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(1)
    .single();

  const { count: calendarsCount } = await supabase
    .from("unit_calendars")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    lastSync,
    calendarsCount: calendarsCount || 0,
  });
}






