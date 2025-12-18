import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET unit calendars
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_calendars")
    .select(`
      *,
      platform_account:platform_accounts(id, account_name, platform)
    `)
    .eq("unit_id", id)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST add calendar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const { platform, ical_url, is_primary, platform_account_id } = body;

  if (!platform || !ical_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // If this calendar is marked as primary, unset other primary calendars for this unit
  if (is_primary) {
    await supabase
      .from("unit_calendars")
      .update({ is_primary: false })
      .eq("unit_id", id);
  }

  const { data, error } = await supabase
    .from("unit_calendars")
    .insert({
      unit_id: id,
      platform,
      ical_url,
      is_primary: is_primary || false,
      platform_account_id: platform_account_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If no primary calendar exists, make this one primary
  if (!is_primary) {
    const { count } = await supabase
      .from("unit_calendars")
      .select("*", { count: "exact", head: true })
      .eq("unit_id", id)
      .eq("is_primary", true);
    
    if (count === 0) {
      await supabase
        .from("unit_calendars")
        .update({ is_primary: true })
        .eq("id", data.id);
      data.is_primary = true;
    }
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE calendar
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendarId");

  if (!calendarId) {
    return NextResponse.json({ error: "Calendar ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("unit_calendars")
    .delete()
    .eq("id", calendarId)
    .eq("unit_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}






