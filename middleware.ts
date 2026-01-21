import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set cookies to never expire (10 years) and ensure they persist
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: 60 * 60 * 24 * 365 * 10, // 10 years - effectively never expires
              expires: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years from now
              sameSite: 'lax',
              httpOnly: name.includes('auth-token') || name.includes('access-token'),
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            });
          });
        },
      },
    }
  );

  // Always refresh session to keep it alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get session separately and refresh it if it exists
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If we have a session, refresh it to extend expiry
  if (session) {
    await supabase.auth.refreshSession();
  }

  // Redirect home to dashboard or login
  if (request.nextUrl.pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login
  if (request.nextUrl.pathname.startsWith("/login") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

