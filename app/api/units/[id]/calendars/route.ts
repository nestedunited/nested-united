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
    .select("*")
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
  const { platform, ical_url, is_primary } = body;

  if (!platform || !ical_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("unit_calendars")
    .insert({
      unit_id: id,
      platform,
      ical_url,
      is_primary: is_primary || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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




