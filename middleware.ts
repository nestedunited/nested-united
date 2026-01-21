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
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Don't override these - let Supabase handle them
              path: '/',
            });
          });
        },
      },
    }
  );

  // IMPORTANT: Do NOT use getSession() directly for auth checks.
  // Use getUser() which validates the token with the server.
  // See: https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Debug logging for Netlify (check function logs)
  if (userError) {
    console.log('[Middleware] getUser error:', userError.message);
  }

  // Helper function to create redirect with cookies preserved
  const redirectWithCookies = (url: string) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url));
    // Copy all cookies from supabaseResponse to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  // Redirect home to dashboard or login
  if (request.nextUrl.pathname === "/") {
    if (user) {
      return redirectWithCookies("/dashboard");
    } else {
      return redirectWithCookies("/login");
    }
  }

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    return redirectWithCookies("/login");
  }

  // Redirect authenticated users away from login
  if (request.nextUrl.pathname.startsWith("/login") && user) {
    return redirectWithCookies("/dashboard");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
