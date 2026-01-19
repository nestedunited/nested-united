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
// 1. دالة قراءة الـ iCal (تم تصحيح خطأ TypeScript هنا)
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

        // FIX: تم إضافة (as string) لحل مشكلة الـ Build
        const statusVal = vevent.getFirstPropertyValue("status");
        const transpVal = vevent.getFirstPropertyValue("transp");
        const descVal = vevent.getFirstPropertyValue("description");

        events.push({
          start: startStr,
          end: endStr,
          summary: event.summary || null,
          uid: event.uid || null,
          // هنا نتحقق من النوع قبل الإرسال لإرضاء TypeScript
          status: typeof statusVal === "string" ? statusVal : null,
          transparency: typeof transpVal === "string" ? transpVal : null,
          description: typeof descVal === "string" ? descVal : null,
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

        for (const event of events) {
          if (!event.start || !event.end) continue;
          if (event.start > event.end) continue;
          if (event.status && event.status.toUpperCase() === "CANCELLED") continue;

          const rangeKey = `${event.start}-${event.end}`;
          primarySet.add(rangeKey);

          if (calendar.platform === "airbnb" || calendar.platform === "gathern") {
             const summaryLower = (event.summary || "").toLowerCase();
             if (
                summaryLower.includes("not available") || 
                summaryLower.includes("unavailable") ||
                summaryLower.includes("blocked") ||
                summaryLower.includes("closed") ||
                summaryLower.includes("غير متاح") || 
                summaryLower.includes("مغلق") ||     
                summaryLower.includes("محجوب")       
             ) continue;

             if (calendar.platform === "airbnb") {
                 const descLower = (event.description || "").toLowerCase();
                 if (summaryLower !== "reserved" && !descLower.includes("http")) continue;
             }
          }

          // التحقق من وجود الحجز الموجود (للتأكد من عدم تعديل الحجوزات المحررة يدوياً)
          const { data: existingReservation } = await supabase
            .from("reservations")
            .select("id, is_manually_edited")
            .eq("unit_id", calendar.unit_id)
            .eq("platform", calendar.platform)
            .eq("start_date", event.start)
            .eq("end_date", event.end)
            .maybeSingle();

          // تخطي الحجوزات المحررة يدوياً - لا نعدلها
          if (existingReservation?.is_manually_edited) continue;

          // استخدام upsert لمنع التكرار:
          // - إذا كان الحجز موجوداً (نفس unit_id, platform, start_date, end_date)، سيتم تحديثه
          // - إذا لم يكن موجوداً، سيتم إنشاؤه
          // الـ unique constraint في قاعدة البيانات يضمن عدم وجود تكرارات
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

        // لا نمسح الحجوزات القديمة - نتركها كما هي
        // الحجوزات القديمة تبقى محفوظة حتى لو لم تعد موجودة في الـ iCal الجديد
        // المستخدم يمكنه حذفها يدوياً إذا أراد

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
    for (const calendar of calendars) {
      if (calendar.is_primary) continue;

      const unitId = calendar.unit_id;

      try {
        console.log(`[NON-PRIMARY] Syncing: ${calendar.unit.unit_name} (${calendar.platform})`);
        const events = await parseICalUrl(calendar.ical_url);
        const primarySet = primaryReservations.get(unitId);

        for (const event of events) {
          if (!event.start || !event.end) continue;
          if (event.start > event.end) continue;
          if (event.status?.toUpperCase() === "CANCELLED") continue;

          if (calendar.platform === "airbnb" || calendar.platform === "gathern") {
            const summaryLower = (event.summary || "").toLowerCase();
            const descLower = (event.description || "").toLowerCase();

            const isBlocked = 
                summaryLower.includes("not available") ||
                summaryLower.includes("unavailable") ||
                summaryLower.includes("blocked") ||
                summaryLower.includes("closed") ||
                summaryLower.includes("غير متاح") || 
                summaryLower.includes("مغلق") ||     
                summaryLower.includes("محجوب") ||    
                summaryLower === "airbnb (not available)";

            if (isBlocked) {
              console.log(`[${calendar.platform} Filter] Dropped Blocked: ${event.summary}`);
              continue;
            }

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

          const eventRange = `${event.start}-${event.end}`;
          if (
              (calendar.platform === "airbnb" || calendar.platform === "gathern") && 
              primarySet && primarySet.has(eventRange)
             ) {
            continue;
          }

          // التحقق من وجود الحجز الموجود (للتأكد من عدم تعديل الحجوزات المحررة يدوياً)
          const { data: existingReservation } = await supabase
            .from("reservations")
            .select("id, is_manually_edited")
            .eq("unit_id", calendar.unit_id)
            .eq("platform", calendar.platform)
            .eq("start_date", event.start)
            .eq("end_date", event.end)
            .maybeSingle();

          // تخطي الحجوزات المحررة يدوياً - لا نعدلها
          if (existingReservation?.is_manually_edited) {
             continue;
          }

          // استخدام upsert لمنع التكرار:
          // - إذا كان الحجز موجوداً (نفس unit_id, platform, start_date, end_date)، سيتم تحديثه
          // - إذا لم يكن موجوداً، سيتم إنشاؤه
          // الـ unique constraint في قاعدة البيانات يضمن عدم وجود تكرارات
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
          }
        }

        // لا نمسح الحجوزات القديمة - نتركها كما هي
        // الحجوزات القديمة تبقى محفوظة حتى لو لم تعد موجودة في الـ iCal الجديد
        // المستخدم يمكنه حذفها يدوياً إذا أراد

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