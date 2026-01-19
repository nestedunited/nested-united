import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Set cookies to never expire (10 years) and ensure they persist
              cookieStore.set(name, value, {
                ...options,
                maxAge: 60 * 60 * 24 * 365 * 10, // 10 years - effectively never expires
                expires: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years from now
                sameSite: 'lax',
                httpOnly: name.includes('auth-token') || name.includes('access-token'),
                secure: process.env.NODE_ENV === 'production',
                path: '/',
              });
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Service-role client (server-only) for privileged operations (bypasses RLS)
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op for service client
        },
      },
    }
  );
}



