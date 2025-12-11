// Supabase Edge Function for iCal Sync
// This function fetches iCal calendars from Airbnb and Gathern
// and stores reservations in the database
//
// Deploy: supabase functions deploy sync-ical
// Test: supabase functions invoke sync-ical
//
// Note: This requires the iCal parsing to be done manually
// since Deno doesn't have full ical.js support

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ParsedEvent {
  start: string;
  end: string;
  summary: string | null;
  uid: string | null;
}

// Simple iCal parser for basic events
function parseICalText(icalText: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const eventBlocks = icalText.split("BEGIN:VEVENT");

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];
    
    const dtstart = block.match(/DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})/);
    const dtend = block.match(/DTEND(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})/);
    const summary = block.match(/SUMMARY:(.+)/);
    const uid = block.match(/UID:(.+)/);

    if (dtstart && dtend) {
      events.push({
        start: `${dtstart[1]}-${dtstart[2]}-${dtstart[3]}`,
        end: `${dtend[1]}-${dtend[2]}-${dtend[3]}`,
        summary: summary ? summary[1].trim() : null,
        uid: uid ? uid[1].trim() : null,
      });
    }
  }

  return events;
}

async function fetchAndParseIcal(url: string): Promise<ParsedEvent[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "RentalsDashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const text = await response.text();
  return parseICalText(text);
}

Deno.serve(async (req) => {
  const startTime = Date.now();

  // Create Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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
      return new Response(
        JSON.stringify({
          success: true,
          message: "لا توجد تقويمات للمزامنة",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Process each calendar
    for (const calendar of calendars) {
      try {
        console.log(`Syncing: ${calendar.unit.unit_name} (${calendar.platform})`);

        const events = await fetchAndParseIcal(calendar.ical_url);

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

    const duration = (Date.now() - startTime) / 1000;

    return new Response(
      JSON.stringify({
        success: true,
        status,
        message,
        unitsProcessed,
        newBookings,
        errorsCount,
        duration: `${duration}s`,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    await logSync(supabase, "failed", error.message, unitsProcessed, errorsCount + 1);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

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
