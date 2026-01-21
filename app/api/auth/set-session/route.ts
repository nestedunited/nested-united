import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const access_token = body?.access_token as string | undefined;
  const refresh_token = body?.refresh_token as string | undefined;

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { ok: false, error: "Missing access_token/refresh_token" },
      { status: 400 }
    );
  }

  let response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.json({ ok: true });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              maxAge: 60 * 60 * 24 * 365 * 10,
              expires: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
              sameSite: "lax",
              // NOTE: must be readable by SSR; Supabase SSR expects these cookies.
              // Keep httpOnly as provided by the adapter/options (don't force true here).
              secure: process.env.NODE_ENV === "production",
              path: "/",
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 }
    );
  }

  return response;
}

