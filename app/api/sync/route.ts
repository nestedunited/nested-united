import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import ICAL from "ical.js";

interface ParsedEvent {
  start: string;
  end: string;
  summary: string | null;
  uid: string | null;
  status?: string | null;
  transparency?: string | null;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// 1. دالة قراءة الـ iCal (ثابتة وممتازة لقراءة التواريخ بدقة)
// ---------------------------------------------------------------------------
async function parseICalUrl(url: string): Promise<ParsedEvent[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RentalsDashboard/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const icalText = await response.text();
    const jcalData = ICAL.parse(icalText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    const events: ParsedEvent[] = [];
    const pad = (n: number) => n.toString().padStart(2, "0");

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      if (event.startDate && event.endDate) {
        const startInfo = event.startDate;
        const endInfo = event.endDate;

        // استخراج التاريخ كنص مباشرة (YYYY-MM-DD)
        const startStr = `${startInfo.year}-${pad(startInfo.month)}-${pad(startInfo.day)}`;
        const endStr = `${endInfo.year}-${pad(endInfo.month)}-${pad(endInfo.day)}`;

        events.push({
          start: startStr,
          end: endStr,
          summary: event.summary || null,
          uid: event.uid || null,
          status: vevent.getFirstPropertyValue("status") || null,
          transparency: vevent.getFirstPropertyValue("transp") || null,
          description: vevent.getFirstPropertyValue("description") || null,
        });
      }
    }

    return events;
  } catch (error: any) {
    console.error(`Error parsing iCal from ${url}:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 2. دالة المعالجة الرئيسية
// ---------------------------------------------------------------------------
export async function POST() {
  const supabase = await createClient();
  const startTime = new Date();

  let unitsProcessed = 0;
  let errorsCount = 0;
  let newBookings = 0;
  const errors: string[] = [];

  try {
    // جلب كل التقويمات للوحدات النشطة
    const { data: calendars, error: fetchError } = await supabase
      .from("unit_calendars")
      .select(`*, unit:units!inner(id, unit_name, status)`)
      .eq("unit.status", "active")
      .order("is_primary", { ascending: false });

    if (fetchError) throw fetchError;

    if (!calendars || calendars.length === 0) {
      return NextResponse.json({
        success: true,
        message: "لا توجد تقويمات للمزامنة",
        unitsProcessed: 0,
      });
    }

    // تجهيز ماب للحجوزات الرئيسية (للمقارنة لاحقاً)
    const primaryReservations = new Map<string, Set<string>>();

    // =========================================================================
    // Pass 1: معالجة التقويمات الأساسية (Primary Calendars)
    // =========================================================================
    for (const calendar of calendars) {
      if (!calendar.is_primary) continue;

      try {
        console.log(`[PRIMARY] Syncing: ${calendar.unit.unit_name} (${calendar.platform})`);
        const events = await parseICalUrl(calendar.ical_url);

        const unitId = calendar.unit_id;
        if (!primaryReservations.has(unitId)) {
          primaryReservations.set(unitId, new Set());
        }
        const primarySet = primaryReservations.get(unitId)!;
        const validEventRangesForPrimary = new Set<string>();

        for (const event of events) {
          if (!event.start || !event.end) continue;
          if (event.start > event.end) continue;
          if (event.status && event.status.toUpperCase() === "CANCELLED") continue;

          // إضافة للمجموعة المرجعية
          const rangeKey = `${event.start}-${event.end}`;
          primarySet.add(rangeKey);
          validEventRangesForPrimary.add(rangeKey);

          // فلترة Airbnb و Gathern في التقويم الأساسي أيضاً
          if (calendar.platform === "airbnb" || calendar.platform === "gathern") {
             const summaryLower = (event.summary || "").toLowerCase();
             
             // قائمة الكلمات المحظورة (عربي وإنجليزي)
             if (
                summaryLower.includes("not available") || 
                summaryLower.includes("unavailable") ||
                summaryLower.includes("blocked") ||
                summaryLower.includes("closed") ||
                summaryLower.includes("غير متاح") || // Gathern Arabic
                summaryLower.includes("مغلق") ||     // Gathern Arabic
                summaryLower.includes("محجوب")       // Gathern Arabic
             ) continue;

             // تحقق إضافي لـ Airbnb
             if (calendar.platform === "airbnb") {
                 const descLower = (event.description || "").toLowerCase();
                 if (summaryLower !== "reserved" && !descLower.includes("http")) continue;
             }
          }

          // التحقق من التعديل اليدوي
          const { data: existingReservation } = await supabase
            .from("reservations")
            .select("id, is_manually_edited")
            .eq("unit_id", calendar.unit_id)
            .eq("platform", calendar.platform)
            .eq("start_date", event.start)
            .eq("end_date", event.end)
            .maybeSingle();

          if (existingReservation?.is_manually_edited) continue;

          // حفظ الحجز
          const { error: upsertError } = await supabase.from("reservations").upsert(
            {
              unit_id: calendar.unit_id,
              platform: calendar.platform,
              start_date: event.start,
              end_date: event.end,
              summary: event.summary,
              raw_event: event,
              last_synced_at: new Date().toISOString(),
              is_manually_edited: false,
            },
            { onConflict: "unit_id,platform,start_date,end_date" }
          );

          if (!upsertError) newBookings++;
        }

        // تنظيف الحجوزات القديمة
        const { data: existingPrimaryReservations } = await supabase
          .from("reservations")
          .select("id, start_date, end_date, is_manually_edited")
          .eq("unit_id", calendar.unit_id)
          .eq("platform", calendar.platform);

        if (existingPrimaryReservations) {
          for (const reservation of existingPrimaryReservations) {
            const range = `${reservation.start_date}-${reservation.end_date}`;
            if (!validEventRangesForPrimary.has(range) && !reservation.is_manually_edited) {
              await supabase.from("reservations").delete().eq("id", reservation.id);
            }
          }
        }

        await supabase.from("units").update({ last_synced_at: new Date().toISOString() }).eq("id", calendar.unit_id);
        unitsProcessed++;

      } catch (error: any) {
        errorsCount++;
        errors.push(`${calendar.unit.unit_name} [PRIMARY]: ${error.message}`);
      }
    }

    // =========================================================================
    // Pass 2: معالجة التقويمات الثانوية (Airbnb & Gathern & Others)
    // =========================================================================
    const validEventRanges = new Map<string, Set<string>>();
    
    for (const calendar of calendars) {
      if (calendar.is_primary) continue;

      const unitId = calendar.unit_id;
      if (!validEventRanges.has(unitId)) validEventRanges.set(unitId, new Set());
      const currentCalendarValidRanges = new Set<string>();

      try {
        console.log(`[NON-PRIMARY] Syncing: ${calendar.unit.unit_name} (${calendar.platform})`);
        const events = await parseICalUrl(calendar.ical_url);
        const primarySet = primaryReservations.get(unitId);

        for (const event of events) {
          if (!event.start || !event.end) continue;
          if (event.start > event.end) continue;
          if (event.status?.toUpperCase() === "CANCELLED") continue;

          // -------------------------------------------------------------------
          // FIX: فلترة موحدة لـ Airbnb و Gathern
          // -------------------------------------------------------------------
          if (calendar.platform === "airbnb" || calendar.platform === "gathern") {
            const summaryLower = (event.summary || "").toLowerCase();
            const descLower = (event.description || "").toLowerCase();

            // 1. فلترة الكلمات المحظورة (Blocks)
            const isBlocked = 
                summaryLower.includes("not available") ||
                summaryLower.includes("unavailable") ||
                summaryLower.includes("blocked") ||
                summaryLower.includes("closed") ||
                summaryLower.includes("غير متاح") || // عربي
                summaryLower.includes("مغلق") ||     // عربي
                summaryLower.includes("محجوب") ||    // عربي
                summaryLower === "airbnb (not available)";

            if (isBlocked) {
              console.log(`[${calendar.platform} Filter] Dropped Blocked: ${event.summary}`);
              continue;
            }

            // 2. فلترة خاصة بـ Airbnb (لزيادة الدقة)
            if (calendar.platform === "airbnb") {
               const isReserved = summaryLower === "reserved";
               const hasUrl = descLower.includes("http") || descLower.includes("reservation");
               
               if (!isReserved && !hasUrl) {
                  if ((event.summary || "").length < 3) continue; 
                  console.log(`[Airbnb Filter] Dropped Suspicious: ${event.summary}`);
                  continue;
               }
            }
          }
          // -------------------------------------------------------------------

          // لو الحجز موجود في الـ Primary، نتجاهله
          const eventRange = `${event.start}-${event.end}`;
          if (
              (calendar.platform === "airbnb" || calendar.platform === "gathern") && 
              primarySet && primarySet.has(eventRange)
             ) {
            continue;
          }

          // التحقق من التعديل اليدوي
          const { data: existingReservation } = await supabase
            .from("reservations")
            .select("id, is_manually_edited")
            .eq("unit_id", calendar.unit_id)
            .eq("platform", calendar.platform)
            .eq("start_date", event.start)
            .eq("end_date", event.end)
            .maybeSingle();

          if (existingReservation?.is_manually_edited) {
             currentCalendarValidRanges.add(eventRange);
             continue;
          }

          const { error: upsertError } = await supabase.from("reservations").upsert(
            {
              unit_id: calendar.unit_id,
              platform: calendar.platform,
              start_date: event.start,
              end_date: event.end,
              summary: event.summary,
              raw_event: event,
              last_synced_at: new Date().toISOString(),
              is_manually_edited: false,
            },
            { onConflict: "unit_id,platform,start_date,end_date" }
          );

          if (!upsertError) {
             newBookings++;
             currentCalendarValidRanges.add(eventRange);
          }
        }

        // تنظيف الحجوزات القديمة (Airbnb & Gathern)
        if (calendar.platform === "airbnb" || calendar.platform === "gathern") {
           const { data: oldReservations } = await supabase
             .from("reservations")
             .select("id, start_date, end_date, is_manually_edited")
             .eq("unit_id", calendar.unit_id)
             .eq("platform", calendar.platform);

           if (oldReservations) {
             for (const res of oldReservations) {
               const range = `${res.start_date}-${res.end_date}`;
               if (!currentCalendarValidRanges.has(range) && !res.is_manually_edited) {
                 await supabase.from("reservations").delete().eq("id", res.id);
               }
             }
           }
        }

        await supabase.from("units").update({ last_synced_at: new Date().toISOString() }).eq("id", calendar.unit_id);
        unitsProcessed++;

      } catch (error: any) {
        errorsCount++;
        errors.push(`${calendar.unit.unit_name}: ${error.message}`);
      }
    }

    const status = errorsCount === 0 ? "success" : errorsCount === calendars.length ? "failed" : "partial";
    const message = `تمت معالجة ${unitsProcessed} وحدة، ${newBookings} حجز`;

    await supabase.from("sync_logs").insert({
      status,
      message,
      units_processed: unitsProcessed,
      errors_count: errorsCount,
      details: errors.length > 0 ? { errors } : null,
    });

    return NextResponse.json({
      success: true,
      status,
      message,
      unitsProcessed,
      newBookings,
      errorsCount,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: lastSync } = await supabase
    .from("sync_logs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ lastSync });
}